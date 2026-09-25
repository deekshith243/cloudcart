# Managed Data Services

## RDS PostgreSQL

Use RDS PostgreSQL in private subnets. Set the full connection string through the `DATABASE_URL` secret. Allow database ingress only from the backend ECS security group. Run committed Prisma migrations with `npx prisma migrate deploy`; never run `prisma migrate reset` against production.

## ElastiCache

Use a private Redis/Valkey-compatible ElastiCache deployment. Set `REDIS_URL` through ECS configuration. The existing cache-aside implementation remains optional and PostgreSQL remains authoritative.

## S3, SQS, and SNS

Create a private S3 bucket with Block Public Access, an order SQS queue, and an SNS order topic. Configure their identifiers through `AWS_S3_BUCKET`, `AWS_SQS_ORDER_QUEUE_URL`, and `AWS_SNS_ORDER_TOPIC_ARN`. ECS task roles provide access; static AWS credentials are not required.
