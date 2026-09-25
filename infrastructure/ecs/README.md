# ECS/Fargate Deployment Artifacts

`backend-task-definition.json` defines the public API task. It listens on port 4000, sends logs to `/ecs/cloudcart/backend`, and uses `/health` for the ECS/ALB health check.

`worker-task-definition.json` defines the private worker task. It exposes no public port and sends logs to `/ecs/cloudcart/worker`.

Replace angle-bracket placeholders before registration. Store `DATABASE_URL` and `JWT_SECRET` in Secrets Manager or SSM Parameter Store and reference their ARNs in the task definition. Use separate ECS services: the backend service attaches to an ALB target group; the worker service does not attach to the ALB.
