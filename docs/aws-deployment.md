# CloudCart AWS Deployment Runbook

This is a placeholder-driven deployment guide for the existing CloudCart application. Replace every `<PLACEHOLDER>` with environment-specific values. No AWS resource is claimed to be deployed by this repository.

## 1. Account Preparation

Prerequisites:

- AWS CLI authenticated to the target account
- Docker Desktop or a Linux Docker host
- Node.js/npm for local checks
- A chosen `<AWS_REGION>`
- A VPC with private subnets for ECS, RDS, and ElastiCache, plus public subnets for the ALB

```powershell
aws sts get-caller-identity
$AWS_REGION = '<AWS_REGION>'
$AWS_ACCOUNT_ID = '<AWS_ACCOUNT_ID>'
```

Use separate security groups: ALB ingress from the internet, backend ingress only from ALB, worker with no public ingress, RDS ingress only from backend, and ElastiCache ingress only from backend.

## 2. ECR Repositories

Follow [infrastructure/ecr-commands.md](../infrastructure/ecr-commands.md) to create and push:

- `cloudcart-backend`
- `cloudcart-worker`
- `cloudcart-frontend`

Build the frontend with the deployed API origin:

```powershell
docker build --build-arg VITE_API_URL=https://<API_DOMAIN> -f frontend/Dockerfile -t cloudcart-frontend:<IMAGE_TAG> frontend
```

## 3. RDS PostgreSQL

Create an RDS PostgreSQL instance in private subnets. Do not expose port 5432 publicly. Store the complete connection string as a Secrets Manager secret named, for example, `<DATABASE_URL_SECRET_NAME>`.

The backend task receives it as `DATABASE_URL`. Preserve the committed migration history. After the backend task can reach RDS:

```powershell
aws ecs run-task ...
# In a controlled migration task/container:
npx prisma migrate deploy
```

Never run `prisma migrate reset` against production. Run the seed only when explicitly initializing a new non-production database, using `SEED_ADMIN_PASSWORD` and `SEED_CUSTOMER_PASSWORD` from secure configuration.

## 4. ElastiCache Redis

Create a private Redis/Valkey-compatible ElastiCache deployment. Allow ingress only from the backend security group. Configure the ECS backend with `REDIS_URL=<ELASTICACHE_REDIS_URL>`. The application remains fail-open if the cache is unavailable.

## 5. S3 Bucket

Create a private bucket for product objects:

```powershell
aws s3api create-bucket --bucket <S3_BUCKET_NAME> --region $AWS_REGION --create-bucket-configuration LocationConstraint=$AWS_REGION
aws s3api put-public-access-block --bucket <S3_BUCKET_NAME> --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

Configure `AWS_REGION` and `AWS_S3_BUCKET`. Use the backend task role for `s3:PutObject` and `s3:DeleteObject` on `products/*`. Do not place AWS credentials in the container.

## 6. SQS Queue and SNS Topic

Create the order event resources:

```powershell
aws sqs create-queue --queue-name <ORDER_QUEUE_NAME> --region $AWS_REGION
aws sns create-topic --name <ORDER_TOPIC_NAME> --region $AWS_REGION
```

Record the returned queue URL and topic ARN as `AWS_SQS_ORDER_QUEUE_URL` and `AWS_SNS_ORDER_TOPIC_ARN`. Configure a suitable SQS visibility timeout and, in production, a dead-letter queue/redrive policy.

## 7. IAM Roles

Create an ECS execution role for pulling ECR images and writing CloudWatch logs. Create separate task roles using:

- [backend-task-policy.json](../infrastructure/iam/backend-task-policy.json)
- [worker-task-policy.json](../infrastructure/iam/worker-task-policy.json)

Backend permissions are limited to S3 object writes/deletes, SQS send, and SNS publish. Worker permissions are limited to SQS receive/delete/visibility operations and SNS publish. Add Secrets Manager read permissions only for the exact secrets referenced by task definitions. Do not use `AdministratorAccess` or static access keys.

## 8. ECS Cluster

```powershell
aws ecs create-cluster --cluster-name cloudcart-production --region $AWS_REGION
```

Create the CloudWatch log groups first:

```powershell
aws logs create-log-group --log-group-name /ecs/cloudcart/backend --region $AWS_REGION
aws logs create-log-group --log-group-name /ecs/cloudcart/worker --region $AWS_REGION
```

## 9. ECS Task Definitions

Replace placeholders in:

- [backend-task-definition.json](../infrastructure/ecs/backend-task-definition.json)
- [worker-task-definition.json](../infrastructure/ecs/worker-task-definition.json)

Register them:

```powershell
aws ecs register-task-definition --cli-input-json file://infrastructure/ecs/backend-task-definition.json --region $AWS_REGION
aws ecs register-task-definition --cli-input-json file://infrastructure/ecs/worker-task-definition.json --region $AWS_REGION
```

Backend secrets should reference Secrets Manager/SSM ARNs. Worker has no public port.

## 10. ECS Services

Create two services in private subnets:

- `cloudcart-backend`: desired count at least 2, attached to the ALB target group
- `cloudcart-worker`: desired count based on queue depth, not attached to the ALB

Both services use `awsvpc` networking and the security groups described above. Enable deployment circuit breakers and rolling deployments.

## 11. ALB

Create an internet-facing ALB in public subnets and a target group for backend port 4000. Configure:

```text
Listener: HTTPS 443 with ACM certificate for <API_DOMAIN>
Forward target group: backend ECS service
Health check: GET /health, port traffic-port, expected 200
```

Redirect HTTP 80 to HTTPS. The backend security group should allow port 4000 only from the ALB security group. The worker is never registered with the ALB.

## 12. CloudWatch

The task definitions use:

- `/ecs/cloudcart/backend`
- `/ecs/cloudcart/worker`

Monitor startup/errors, order event publication, worker processing failures, SQS age/depth, ECS restarts, ALB 5xx responses, RDS health, and Redis health. Configure log retention and alarms appropriate to the environment. Never log passwords, JWTs, AWS credentials, or unnecessary personal data.

## 13. Environment and Secrets

Backend runtime variables:

```text
NODE_ENV=production
API_PORT=4000
DATABASE_URL=<Secrets Manager reference>
JWT_SECRET=<Secrets Manager reference>
JWT_EXPIRES_IN=15m
JWT_ISSUER=cloudcart-api
CORS_ORIGIN=https://<FRONTEND_DOMAIN>
REDIS_URL=<ELASTICACHE_REDIS_URL>
AWS_REGION=<AWS_REGION>
AWS_S3_BUCKET=<S3_BUCKET_NAME>
AWS_SQS_ORDER_QUEUE_URL=<SQS_QUEUE_URL>
AWS_SNS_ORDER_TOPIC_ARN=<SNS_TOPIC_ARN>
```

Worker runtime variables:

```text
NODE_ENV=production
AWS_REGION=<AWS_REGION>
AWS_SQS_ORDER_QUEUE_URL=<SQS_QUEUE_URL>
AWS_SNS_ORDER_TOPIC_ARN=<SNS_TOPIC_ARN>
```

Prefer ECS task roles and Secrets Manager. Do not set static AWS access keys in task definitions or images.

## 14. Database Migration

After networking, security groups, secrets, and the backend image are ready, run the migration from a controlled backend migration task:

```powershell
npm --prefix backend run prisma:migrate:deploy
```

Do not use `prisma migrate reset`. Do not destroy existing production data.

## 15. Frontend Deployment

Option A: serve `cloudcart-frontend` through a separate static host/CDN or an ECS/Nginx service. Build with:

```powershell
npm --prefix frontend run build
docker build --build-arg VITE_API_URL=https://<API_DOMAIN> -f frontend/Dockerfile -t cloudcart-frontend:<IMAGE_TAG> frontend
```

Option B: publish the `frontend/dist` directory to a private S3 origin behind CloudFront. This project does not claim that S3/CloudFront frontend hosting has been deployed.

## 16. Verification

```powershell
Invoke-RestMethod https://<API_DOMAIN>/health
Invoke-RestMethod https://<API_DOMAIN>/api/v1/products
```

Then verify login, product image upload, cart checkout, order history, SQS queue movement, worker logs, SNS publish behavior, and ALB target health. Verify that RDS and ElastiCache have no public ingress.

## Deployment Status

This repository contains Dockerfiles, task definitions, IAM policy documents, commands, and this runbook. AWS account access, credentials, networking, and deployment execution were not available during implementation, so no AWS resource is claimed as deployed.
