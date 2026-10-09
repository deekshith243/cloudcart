# Production Infrastructure

The `terraform/` directory is the infrastructure-as-code source for a new CloudCart AWS environment. It defines configuration for the VPC, private/public subnets, NAT, security groups, S3, SQS/DLQ, SNS, RDS PostgreSQL, ElastiCache Redis, Secrets Manager, IAM, ECR, CloudWatch, ECS/Fargate, and the backend ALB/service.

No resource has been applied by this repository. Start with [the deployment readiness guide](../docs/deployment-readiness.md), copy `terraform/terraform.tfvars.example` to an untracked `terraform.tfvars`, and run Terraform only after reviewing the cost and security settings.

The existing JSON task definitions and IAM policy documents remain reference artifacts for manual deployments. They contain placeholders and are not the Terraform source of truth.
