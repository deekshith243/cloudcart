# Application Load Balancer

Create an internet-facing ALB in public subnets with a target group pointing to the backend ECS service on port 4000. Configure the target group health check as:

```text
Path: /health
Port: traffic-port
Protocol: HTTP
Success codes: 200
```

Only the ALB security group should accept public API traffic. The backend task security group should accept port 4000 only from the ALB security group. RDS and ElastiCache should not have public ingress. The worker is a separate ECS service and is never registered with the ALB.
