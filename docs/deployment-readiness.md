# CloudCart Deployment Readiness

Audit date: 2026-10-08

This audit is based on the source code, configuration, Dockerfiles, Prisma schema and migration, Terraform configuration, infrastructure artifacts, and existing documentation in this repository. The repository contains no AWS account state, deployed-resource evidence, Terraform state, or CI/CD pipeline, so Terraform resources are definitions only until explicitly applied.

## Executive Status

CloudCart is a working local application with production-oriented container and AWS integration code. It is **not ready for direct AWS deployment**. The code compiles and its automated tests pass, but deployment still requires real AWS resources, environment/secrets configuration, network and IAM setup, and database migration execution.

## Component Classification

| Component                        | Classification                                                                       | Verified status                                                                                                                                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend Express API              | COMPLETE AND WORKING                                                                 | Routes, authentication, catalog, cart, orders, admin operations, validation, error handling, Helmet, CORS, and rate limiting are implemented. `npm run build`, tests, and lint pass.                                                                                |
| Frontend React/Vite application  | COMPLETE AND WORKING locally; IMPLEMENTED BUT NEEDS CONFIGURATION for production API | Production build passes. `VITE_API_URL` is build-time configuration. Private S3 references are resolved through the backend before rendering.                                                                                                                       |
| Background worker                | COMPLETE AND WORKING locally; IMPLEMENTED BUT NEEDS CONFIGURATION                    | SQS long polling, event validation, SNS publishing, delete-after-success behavior, duplicate order-id suppression, retry behavior, and shutdown handling are implemented. It idles when the queue is not configured.                                                |
| PostgreSQL/Prisma                | IMPLEMENTED BUT NEEDS CONFIGURATION                                                  | Prisma schema, one committed initial migration, adapter-based client, seed, and `migrate:deploy` script exist. RDS, credentials, connectivity, and migration execution are not provisioned here.                                                                    |
| Redis cache                      | IMPLEMENTED BUT NEEDS CONFIGURATION                                                  | Redis client is used for catalog caching and invalidation, connects from `REDIS_URL`, reports health, and fails open when unavailable. ElastiCache and its security group are not provisioned.                                                                      |
| S3 image storage                 | IMPLEMENTED BUT NEEDS CONFIGURATION                                                  | Backend uses AWS SDK `S3Client`, `PutObject`, `DeleteObject`, and presigned `GetObject` URLs for private admin uploads and browser delivery. The bucket remains private and credentials stay backend-side.                                                          |
| SQS order events                 | IMPLEMENTED BUT NEEDS CONFIGURATION                                                  | Backend sends `ORDER_CREATED` after the order transaction. Missing configuration makes publishing a no-op, and publish failure is logged without rolling back the committed order. Queue, DLQ/redrive policy, visibility tuning, and IAM are external requirements. |
| SNS notifications                | IMPLEMENTED BUT NEEDS CONFIGURATION                                                  | Worker publishes validated order events to the configured topic. The topic, subscriptions, permissions, and monitoring are external requirements.                                                                                                                   |
| Docker images                    | IMPLEMENTED BUT NEEDS CONFIGURATION                                                  | Backend, worker, and frontend multi-stage Dockerfiles exist with Docker context exclusions. Backend and frontend have container health checks. Docker CLI was unavailable during this audit, so local image builds remain unverified.                               |
| Docker Compose                   | PARTIALLY IMPLEMENTED                                                                | Starts local PostgreSQL and Redis only. It does not run backend, frontend, worker, SQS, SNS, or S3 emulators, so it is not a production topology or full integration environment.                                                                                   |
| ECS/Fargate                      | IMPLEMENTED BUT NEEDS CONFIGURATION                                                  | Terraform defines the Fargate cluster, backend/worker/frontend task definitions and conditional services, private networking, task roles, logging, deployment circuit breakers, and shared ALB routing.                                                             |
| ALB                              | PARTIALLY IMPLEMENTED; NEEDS CONFIGURATION                                           | `/health`, target port 4000, and ALB guidance exist. No ALB, listeners, ACM certificate, target group, DNS, security groups, or service attachment is provisioned.                                                                                                  |
| IAM                              | IMPLEMENTED BUT NEEDS CONFIGURATION                                                  | Terraform defines separate ECS execution, backend task, and worker task roles with scoped ECR/log/secret, S3, SQS, and SNS permissions. Review the generated plan and account policies before applying.                                                             |
| CloudWatch                       | IMPLEMENTED BUT NEEDS CONFIGURATION                                                  | Terraform defines backend, worker, and frontend log groups with configurable retention and ECS `awslogs` configuration. Alarms, dashboards, and alert routing remain follow-up work.                                                                                |
| Production configuration/secrets | IMPLEMENTED BUT NEEDS CONFIGURATION                                                  | `.env.example` files and ECS secret placeholders document the inputs. No production values, Secrets Manager secrets, parameter references, or rotation setup exist.                                                                                                 |
| AWS deployment automation        | IMPLEMENTED BUT NEEDS CONFIGURATION                                                  | `infrastructure/terraform` defines the AWS resource graph, but it has not been initialized, validated, planned, or applied in this environment. There is no CI/CD workflow.                                                                                         |

## AWS Integration Verification

### S3

Actually integrated in backend code. `backend/src/services/s3-service.ts` creates an AWS SDK client and sends `PutObjectCommand` and `DeleteObjectCommand`. `backend/src/app.ts` injects that service into product image operations, and the admin image route is protected by authentication and the `ADMIN` role.

The backend keeps the existing `s3://bucket/key` database reference. `GET /api/v1/products/:id/image-url` validates the stored reference and returns a temporary presigned `GetObject` URL, or `null` for a missing/invalid reference. The frontend calls this endpoint for S3 references and passes only the returned HTTPS URL to `<img>`; ordinary non-S3 URLs remain supported. S3 signing failures return a controlled service-unavailable error.

`AWS_S3_PRESIGNED_URL_EXPIRES_IN` controls URL lifetime and defaults to 900 seconds. Required before deployment: `AWS_REGION`, `AWS_S3_BUCKET`, a private bucket, Block Public Access, encryption, task-role permissions, and this expiration setting if the default is unsuitable. Static access keys are not required when ECS task roles are used, although the local example still lists optional access-key variables.

### SQS

Actually integrated in backend code. `backend/src/services/sqs-service.ts` sends `ORDER_CREATED` messages to the configured queue, and `backend/src/services/order-service.ts` publishes after the order repository completes. Publishing is intentionally fail-open: an order can succeed while its event is unavailable.

Actually integrated in worker code. `worker/src/sqs-consumer.ts` receives up to ten messages with long polling, keeps failed messages for retry, and deletes only after successful SNS publication.

Required before deployment: queue URL, queue policy/task-role permissions, visibility timeout aligned with processing time, DLQ and redrive policy, queue monitoring, and consideration of an outbox if event delivery must be guaranteed.

### SNS

Actually integrated in worker code. `AwsNotificationClient` publishes validated events to `AWS_SNS_ORDER_TOPIC_ARN`. No email/SMS subscriber is implemented; SNS is currently a fan-out boundary only.

Required before deployment: topic ARN, worker task-role `sns:Publish`, topic subscriptions if needed, and failure/latency monitoring.

### Redis and ElastiCache

Actually integrated in backend code. `RedisCacheService` uses the Node Redis client, caches catalog data, invalidates keys, and exposes `ok`, `unavailable`, or `disabled` health state. The API starts even when Redis is unavailable.

ElastiCache readiness is configuration-only: Terraform creates a private Redis deployment with at-rest and in-transit encryption, and sets the backend `REDIS_URL` to `rediss://...`. The existing Node Redis client supports this URL. Allow port 6379 only from the backend task security group. PostgreSQL remains authoritative.

### ECS/Fargate, RDS, ALB, IAM, and CloudWatch

- **ECS/Fargate:** Terraform defines the cluster, private backend/worker/frontend services, task definitions, roles, logs, deployment circuit breakers, and shared ALB routing.
- **RDS:** Terraform defines a private encrypted PostgreSQL instance, subnet group, restricted security group, generated credentials, and Secrets Manager database URL. Run the dedicated migration image once RDS is available.
- **ALB:** Terraform defines a public ALB, backend target group, `/health` check, HTTP listener, and optional ACM-backed HTTPS listener with HTTP redirect.
- **IAM:** Terraform defines separate ECS execution, backend task, and worker task roles. ECS execution can read only the two application secrets; the backend task has S3 object and SQS send access, while the worker has SQS receive/delete/visibility and SNS publish access.
- **CloudWatch:** Terraform defines backend, worker, and frontend log groups and connects all three task definitions to `awslogs`.

## Runtime Environment Variables

### Backend

Required or expected in production:

```text
NODE_ENV=production
PORT=4000
API_PORT=4000
DATABASE_URL=<RDS PostgreSQL connection string>
JWT_SECRET=<long random secret>
JWT_EXPIRES_IN=15m
JWT_ISSUER=cloudcart-api
CORS_ORIGIN=https://<frontend-domain>
REDIS_URL=<private ElastiCache Redis/Valkey URL>
AWS_REGION=<region>
AWS_S3_BUCKET=<private bucket>
AWS_SQS_ORDER_QUEUE_URL=<queue URL>
AWS_SNS_ORDER_TOPIC_ARN=<topic ARN>
```

`DATABASE_URL` and `JWT_SECRET` should be injected from Secrets Manager or SSM. AWS SDK task-role credentials should be used instead of `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in ECS.

The repository root `.env.example` also contains `SEED_ADMIN_PASSWORD`, `SEED_CUSTOMER_PASSWORD`, and `AWS_OPENSEARCH_ENDPOINT`. OpenSearch is not implemented anywhere in the inspected application and is not part of the deployment path.

### Worker

```text
NODE_ENV=production
AWS_REGION=<region>
AWS_SQS_ORDER_QUEUE_URL=<queue URL>
AWS_SNS_ORDER_TOPIC_ARN=<topic ARN>
```

The worker does not need `DATABASE_URL`, Redis, S3, or a public port.

### Frontend

```text
VITE_API_URL=https://<api-domain>
```

This is embedded during the Vite build. It is not a runtime container environment variable after the static files are built.

## Container Deployment Details

The repository supports three separate production images:

| Image                | Dockerfile            | Container port                              | Runtime                      |
| -------------------- | --------------------- | ------------------------------------------- | ---------------------------- |
| `cloudcart-backend`  | `backend/Dockerfile`  | `4000` by default, configurable with `PORT` | `node dist/server.js`        |
| `cloudcart-worker`   | `worker/Dockerfile`   | None                                        | `node dist/worker.js`        |
| `cloudcart-frontend` | `frontend/Dockerfile` | `8080`                                      | Nginx serving the Vite build |

Build from the repository root:

```powershell
docker build -f backend/Dockerfile -t cloudcart-backend:<IMAGE_TAG> backend
docker build -f worker/Dockerfile -t cloudcart-worker:<IMAGE_TAG> worker
docker build --build-arg VITE_API_URL=https://<API_DOMAIN> -f frontend/Dockerfile -t cloudcart-frontend:<IMAGE_TAG> frontend
```

Run locally after supplying real backend/worker environment files:

```powershell
docker run --rm --env-file backend/.env -p 4000:4000 cloudcart-backend:<IMAGE_TAG>
docker run --rm --env-file worker/.env cloudcart-worker:<IMAGE_TAG>
docker run --rm -p 8080:8080 cloudcart-frontend:<IMAGE_TAG>
```

The backend image includes the generated Prisma client and only production dependencies in its final stage. The worker image has no public port. Neither image copies environment files, credentials, or local dependency/build directories. The backend and worker receive `SIGTERM`/`SIGINT` handlers; the API closes its HTTP server and Redis connection, while the worker stops polling after its current receive cycle.

For ECS, register the backend task with container port 4000 and attach it to the ALB target group. Set `PORT` and the ECS port mapping consistently if using a non-default port. Configure the ALB health check as unauthenticated `GET /health` expecting HTTP 200. Run the worker as a separate private service with no load balancer or public ingress. The Terraform stack runs the existing Nginx frontend as a separate private service on port 8080 behind the same ALB. Use ECS task roles for AWS access, Secrets Manager/SSM references for secrets, and the `awslogs` driver for stdout/stderr collection.

## Terraform Infrastructure

The Terraform source is under `infrastructure/terraform`:

```text
providers.tf          AWS/random providers and default tags
variables.tf          region, image, network, service, and cost inputs
main.tf               VPC, subnets, gateways, and route tables
security-groups.tf    ALB, ECS, RDS, and Redis least-privilege ingress
s3.tf                 private encrypted product-image bucket
sqs-sns.tf            order queue, DLQ, redrive policy, and topic
rds.tf                private encrypted PostgreSQL
redis.tf              private single-node Redis replication group
secrets.tf            generated database/JWT Secrets Manager values
iam.tf                execution and separate backend/worker task roles
ecr.tf                immutable, scan-on-push image repositories
cloudwatch.tf         backend, worker, and frontend log groups
alb.tf                public ALB, target group, health check, listeners
ecs.tf                Fargate cluster, backend/worker tasks and services
outputs.tf            deployment endpoints and resource identifiers
```

The stack uses one NAT gateway by default to reduce interview-project cost. Set `single_nat_gateway = false` for one NAT gateway per AZ. Terraform creates ECR repositories and conditional ECS services for `cloudcart-backend`, `cloudcart-worker`, and the existing Nginx `cloudcart-frontend` image. The shared public ALB sends `/api/*` and `/health` to the backend and other paths to the frontend. Keep `enable_ecs_services = false` for the first apply, then set it to `true` after pushing images.

## ECR and ECS Deployment Procedure

After `terraform apply` creates the ECR repositories, authenticate and push immutable image tags:

```powershell
$REGISTRY = (terraform output -json ecr_repository_urls | ConvertFrom-Json).backend.Split('/')[0]
$IMAGE_TAG = "2026-10-08-<GIT_SHA>"
aws ecr get-login-password --region <AWS_REGION> | docker login --username AWS --password-stdin $REGISTRY
docker build -f backend/Dockerfile -t "$REGISTRY/cloudcart-backend`:$IMAGE_TAG" backend
docker build -f worker/Dockerfile -t "$REGISTRY/cloudcart-worker`:$IMAGE_TAG" worker
docker build --build-arg VITE_API_URL=https://<PUBLIC_ORIGIN> -f frontend/Dockerfile -t "$REGISTRY/cloudcart-frontend`:$IMAGE_TAG" frontend
docker push "$REGISTRY/cloudcart-backend`:$IMAGE_TAG"
docker push "$REGISTRY/cloudcart-worker`:$IMAGE_TAG"
docker push "$REGISTRY/cloudcart-frontend`:$IMAGE_TAG"
```

Set the three image variables in `terraform.tfvars` to those immutable URIs, then run `terraform plan` and `terraform apply` again. Terraform creates or updates the backend, worker, and frontend ECS services. Backend tasks are private ALB targets on port 4000, frontend tasks are private ALB targets on port 8080, and worker tasks have no listener or public ingress.

## Deployment Blockers

1. No AWS resources have been applied by this repository. AWS account access, state storage, credentials, and review of the Terraform plan are still required.
2. The legacy JSON task definitions and IAM policies contain placeholders; use `infrastructure/terraform` as the source of truth for the new deployment.
3. The frontend ECS service is defined, but its image must be built with the final API origin and pushed before the service can start. DNS and an ACM certificate remain manual inputs.
4. Database migrations must be run from a controlled private ECS task using the backend Dockerfile's `migration` target after RDS networking and secrets are available. The application does not run migrations automatically at startup.
5. The API health endpoint proves only that the process responds; it does not verify PostgreSQL, SQS, SNS, S3, or Redis.
6. SQS publishing is not transactional with the database. A committed order can lack an order event if SQS is unavailable; use an outbox or explicitly accept this failure mode.
7. No production alarms or dashboards are defined: log retention is configured for backend, worker, and frontend, but queue age/depth, ALB 5xx, ECS restart, RDS, and Redis alerting remain follow-up work.

## Recommended Deployment Order

1. Review costs, choose an AWS region/AZ pair, create encrypted remote Terraform state, and copy `infrastructure/terraform/terraform.tfvars.example` to an untracked `terraform.tfvars`.
2. Keep `enable_ecs_services = false` for the initial apply so ECS does not attempt to start from unpushed image tags.
3. Build and push immutable backend, worker, and frontend images to the Terraform-created ECR repositories.
4. Run `terraform init`, `terraform fmt -check`, `terraform validate`, and `terraform plan -var-file=terraform.tfvars`. Review all security groups, IAM policies, secret resources, and replacement actions.
5. Run `terraform apply -var-file=terraform.tfvars` only after the plan is approved. This creates the VPC, private data services, S3/SQS/SNS, IAM, ECR, logging, task definitions, and backend ALB.
6. Set `enable_ecs_services = true`, confirm the image variables and frontend `VITE_API_URL` use the shared public origin, then run `terraform plan` and `terraform apply` again to start all three ECS services.
7. Build and push the backend `migration` target, then run it once as a private ECS task with the generated database secret and `npx prisma migrate deploy`.
8. Verify the ALB URL from `terraform output -raw alb_dns_name`; use HTTPS only after supplying an ACM certificate ARN and DNS record.
9. Run smoke tests for health, authentication, catalog reads, admin image upload, cart checkout, order history, SQS movement, worker SNS publication, ALB target health, RDS connectivity, and Redis behavior.

## Secrets, Migration, and Operations

Terraform generates the RDS password and JWT secret with the `random_password` provider and stores them as JSON keys in Secrets Manager. Their values are not outputs or Terraform variables, but they are present in Terraform state, so state must be encrypted and access-controlled. ECS injects `DATABASE_URL` and `JWT_SECRET` by JSON key; AWS task roles provide all SDK access without static keys.

After the RDS instance is available, build the migration target from the backend context:

```powershell
docker build --target migration -f backend/Dockerfile -t <MIGRATION_IMAGE> backend
docker push <MIGRATION_IMAGE>
aws ecs run-task --cluster <ECS_CLUSTER> --task-definition <MIGRATION_TASK_DEFINITION> --network-configuration <PRIVATE_AWSVPC_CONFIGURATION> --overrides <DATABASE_URL_OVERRIDE>
```

The exact one-off task definition must use private subnets, the backend security group, the execution role, and the database secret. Run `npx prisma migrate deploy` only after RDS is reachable; never use `prisma migrate reset`.

The ALB URL is the `alb_dns_name` Terraform output. Backend and worker stdout/stderr are collected in the Terraform-created CloudWatch groups. `terraform destroy -var-file=terraform.tfvars` removes the managed stack, but RDS snapshots, S3 data, Secrets Manager recovery windows, and NAT/ALB/ECS usage require deliberate review before destruction.

Expected cost warnings for this small configuration: NAT gateways, ALB hourly/load-balancer usage, RDS instance/storage, ElastiCache, ECS Fargate runtime, ECR storage, CloudWatch logs, and public IPv4/NAT data processing can incur charges even with low traffic. A single NAT gateway is enabled by default only to reduce cost, not to provide multi-AZ resilience.

## Repository Verification

Executed on 2026-10-08:

- `npm run build`: passed for frontend, backend, and worker.
- `npm test`: passed: 6 backend files / 54 tests, 1 frontend file / 4 tests, and 1 worker file / 4 tests.
- `npm run lint`: passed for frontend, backend, and worker.
- `npm --prefix backend run build`: passed.
- `npm --prefix frontend run build`: passed.
- `npm --prefix worker run build`: passed.
- Terraform validation was not run because Terraform is not installed or on `PATH` in the audit environment.
- AWS CLI/resource validation was not run because the AWS CLI is not installed or on `PATH`; no AWS resources were created.
- `npm --prefix backend run prisma:validate`: could not run because `DATABASE_URL` was not set in the audit environment; this is an environment prerequisite failure, not evidence of an invalid schema.
- Docker image builds and container startup/health checks were not run because Docker is not installed or on `PATH` in the audit environment.

## Final Assessment

The core application, Prisma model/migration, Redis boundary, private S3 operations with presigned browser delivery, SQS producer/consumer, SNS worker publisher, production Dockerfiles, and Terraform definitions for the target AWS architecture are present. The remaining work is Terraform initialization/review/application, image pushes, migration execution, frontend hosting choice, and operational verification.

**CloudCart is not ready to deploy to AWS yet.** Initialize and validate Terraform, review and apply the plan, push immutable images, run the RDS migration task, complete frontend hosting/DNS, and perform end-to-end smoke tests before calling the deployment ready.
