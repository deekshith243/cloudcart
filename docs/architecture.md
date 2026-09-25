# CloudCart Architecture

```text
React frontend -> AWS ALB -> ECS/Fargate Node.js API
                                      |-> RDS PostgreSQL
                                      |-> ElastiCache Redis
                                      |-> S3 product images
                                      `-> SQS -> separate worker -> SNS
```

The API owns synchronous HTTP requests. RDS PostgreSQL remains the source of truth, ElastiCache Redis is an optional cache, and S3 stores product image objects. After a successful order transaction, the API publishes a minimal event to SQS. The separate worker validates the event and publishes to SNS for future subscribers. CloudWatch receives API/worker logs, and IAM task roles control AWS access. AWS resources are configuration-only until actually deployed.

## Database Architecture

PostgreSQL is the system of record for users, catalog data, carts, and orders. Prisma owns the schema and migration history in `backend/prisma`. Monetary values use PostgreSQL `DECIMAL(12, 2)` fields. `OrderItem.priceAtPurchase` is copied when an order is created, so later product price changes cannot rewrite historical order totals.

The schema uses UUID primary keys, unique user emails/category names, one cart per user, and one cart/order line per product through compound unique constraints. Carts and line items cascade when their parent is removed. Products and users referenced by order history use restrictive foreign keys so historical records cannot be invalidated accidentally.
