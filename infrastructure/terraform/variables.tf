variable "aws_region" {
  description = "AWS region for all CloudCart resources."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Short project name used in resource names."
  type        = string
  default     = "cloudcart"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "production"
}

variable "availability_zones" {
  description = "At least two AZs. When empty, the first two available AZs are selected."
  type        = list(string)
  default     = []

  validation {
    condition     = length(var.availability_zones) == 0 || length(var.availability_zones) >= 2
    error_message = "availability_zones must be empty or contain at least two AZs."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the CloudCart VPC."
  type        = string
  default     = "10.42.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public ALB/NAT subnets, one per selected AZ."
  type        = list(string)
  default     = ["10.42.1.0/24", "10.42.2.0/24"]

  validation {
    condition     = length(var.public_subnet_cidrs) >= 2
    error_message = "public_subnet_cidrs must contain at least two CIDR blocks."
  }
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private ECS/data subnets, one per selected AZ."
  type        = list(string)
  default     = ["10.42.11.0/24", "10.42.12.0/24"]

  validation {
    condition     = length(var.private_subnet_cidrs) >= 2
    error_message = "private_subnet_cidrs must contain at least two CIDR blocks."
  }
}

variable "single_nat_gateway" {
  description = "Use one NAT gateway to reduce interview/development cost."
  type        = bool
  default     = true
}

variable "backend_image" {
  description = "Immutable ECR URI and tag for the backend image."
  type        = string
}

variable "worker_image" {
  description = "Immutable ECR URI and tag for the worker image."
  type        = string
}

variable "frontend_image" {
  description = "Immutable ECR URI and tag for the frontend image."
  type        = string
}

variable "frontend_origin" {
  description = "Shared public origin used by the frontend and backend CORS, for example https://shop.example.com."
  type        = string
}

variable "acm_certificate_arn" {
  description = "Optional ACM certificate ARN. When set, HTTPS is created and HTTP redirects to it."
  type        = string
  default     = ""
}

variable "s3_bucket_name" {
  description = "Optional globally unique S3 bucket name. Empty derives one from project/account/region."
  type        = string
  default     = ""
}

variable "s3_force_destroy" {
  description = "Allow Terraform to delete non-empty image buckets; keep false for production data."
  type        = bool
  default     = false
}

variable "order_queue_name" {
  description = "SQS order event queue name; the application consumes its Terraform output URL."
  type        = string
  default     = "cloudcart-order-events"
}

variable "order_topic_name" {
  description = "SNS order event topic name; the application consumes its Terraform output ARN."
  type        = string
  default     = "cloudcart-order-events"
}

variable "database_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "cloudcart"
}

variable "database_username" {
  description = "RDS master username; password is generated and stored in Secrets Manager."
  type        = string
  default     = "cloudcart"
}

variable "rds_instance_class" {
  description = "Small RDS instance class for interview/development use."
  type        = string
  default     = "db.t3.micro"
}

variable "rds_allocated_storage" {
  description = "Initial RDS storage in GiB."
  type        = number
  default     = 20
}

variable "rds_skip_final_snapshot" {
  description = "Skip the final snapshot on destroy; keep false where data matters."
  type        = bool
  default     = true
}

variable "redis_node_type" {
  description = "Small ElastiCache Redis node type for interview/development use."
  type        = string
  default     = "cache.t4g.micro"
}

variable "log_retention_days" {
  description = "CloudWatch log retention for ECS application logs."
  type        = number
  default     = 14
}

variable "backend_desired_count" {
  description = "Initial backend ECS service desired count."
  type        = number
  default     = 1
}

variable "worker_desired_count" {
  description = "Initial worker ECS service desired count."
  type        = number
  default     = 1
}

variable "frontend_desired_count" {
  description = "Initial frontend ECS service desired count."
  type        = number
  default     = 1
}

variable "enable_ecs_services" {
  description = "Create/rerun ECS services after immutable images have been pushed to ECR."
  type        = bool
  default     = false
}