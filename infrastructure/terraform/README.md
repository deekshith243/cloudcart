# CloudCart Terraform

This stack defines the AWS resources required by the existing CloudCart backend and worker. It does not deploy anything until `terraform apply` is explicitly run.

## Usage

```powershell
Copy-Item terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars; never add secrets to it.
terraform init
terraform fmt -check
terraform validate
terraform plan -var-file=terraform.tfvars
```

Keep `enable_ecs_services = false` for the first apply. Push the immutable images to the ECR repositories, set the image variables, change it to `true`, and apply again to start the backend, worker, and frontend services.

Terraform generates the RDS password and JWT secret and stores them in AWS Secrets Manager. Protect the Terraform state because generated secret values are represented in state. Use an encrypted remote state backend before a shared or production deployment.

The existing Nginx frontend is managed as a private ECS service behind the same ALB. `/api/*` and `/health` route to the backend; other paths route to Nginx. Build the frontend image with the shared ALB origin as `VITE_API_URL` before enabling the ECS services.

## Migration image

The production backend image omits the Prisma CLI. Build the dedicated migration target after the RDS endpoint and secrets are available:

```powershell
docker build --target migration -f ../../backend/Dockerfile -t <MIGRATION_IMAGE> ../../backend
docker push <MIGRATION_IMAGE>
```

Run that image once as a private ECS task with `DATABASE_URL` injected from the database secret and command `npx prisma migrate deploy`. Do not run `prisma migrate reset` against RDS.
