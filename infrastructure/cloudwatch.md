# CloudWatch Logging

Create log groups before registering task definitions:

```powershell
aws logs create-log-group --log-group-name /ecs/cloudcart/backend --region <AWS_REGION>
aws logs create-log-group --log-group-name /ecs/cloudcart/worker --region <AWS_REGION>
```

The ECS `awslogs` driver streams backend and worker stdout/stderr. Set retention according to the environment. Do not log passwords, JWTs, AWS credentials, or unnecessary customer data.
