output "vpc_id" {
  description = "CloudCart VPC ID."
  value       = aws_vpc.this.id
}

output "alb_dns_name" {
  description = "Public ALB DNS name."
  value       = aws_lb.this.dns_name
}

output "frontend_url" {
  description = "Frontend URL; use HTTPS after supplying an ACM certificate and DNS name."
  value       = var.acm_certificate_arn == "" ? "http://${aws_lb.this.dns_name}" : "https://${aws_lb.this.dns_name}"
}

output "ecr_repository_urls" {
  description = "ECR repository URLs for all CloudCart images."
  value = {
    backend  = aws_ecr_repository.backend.repository_url
    worker   = aws_ecr_repository.worker.repository_url
    frontend = aws_ecr_repository.frontend.repository_url
  }
}

output "s3_bucket_name" {
  description = "Private product image bucket name."
  value       = aws_s3_bucket.product_images.bucket
}

output "sqs_queue_url" {
  description = "Order event queue URL for AWS_SQS_ORDER_QUEUE_URL."
  value       = aws_sqs_queue.order_events.url
}

output "sns_topic_arn" {
  description = "Order event topic ARN for AWS_SNS_ORDER_TOPIC_ARN."
  value       = aws_sns_topic.order_events.arn
}

output "rds_endpoint" {
  description = "Private RDS PostgreSQL endpoint."
  value       = aws_db_instance.postgres.address
}

output "redis_endpoint" {
  description = "Private ElastiCache Redis endpoint."
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.this.name
}

output "database_url_secret_arn" {
  description = "Secrets Manager ARN containing the generated DATABASE_URL."
  value       = aws_secretsmanager_secret.database_url.arn
}

output "jwt_secret_arn" {
  description = "Secrets Manager ARN containing the generated JWT_SECRET."
  value       = aws_secretsmanager_secret.jwt.arn
}