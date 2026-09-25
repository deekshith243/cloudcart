# CloudCart Authentication Interview Questions

## Why bcrypt?

bcrypt is a deliberately slow password hashing function with a work factor. It stores a one-way hash and makes large-scale guessing more expensive. CloudCart uses 12 rounds and never stores or returns the plaintext password.

## Why JWT?

A short-lived signed access token lets the API authenticate requests without server-side session storage. CloudCart validates the signature, issuer, token type, claims, and expiration on every protected request.

## Authentication vs authorization?

Authentication establishes identity. Authorization checks permissions. CloudCart's `authenticate` middleware identifies a user, then `requireRole('ADMIN')` decides whether that user may access the admin dashboard.

## Why can users not register as ADMIN?

Allowing a request body to select `ADMIN` would be privilege escalation. Registration ignores client role input and always persists `CUSTOMER`. Admin provisioning is controlled separately.

## What happens when a JWT expires or is invalid?

JWT verification fails and the middleware returns `401`. The response does not reveal whether a signature, issuer, token type, or expiration check failed.

## What is 401 vs 403?

`401` means the request is not authenticated. `403` means the request is authenticated but lacks permission. A customer calling the admin endpoint receives `403`; an anonymous caller receives `401`.

## Where is JWT_SECRET stored?

Only in environment configuration, represented by `JWT_SECRET` in `backend/.env.example`. It is not committed to source control and is never logged.

## Why should passwords not be logged?

Logs commonly have broad access and long retention. Logging credentials or hashes creates an avoidable credential-compromise path.

## What are stateless JWT logout limitations?

The server cannot invalidate an already-issued access token without maintaining revocation state. This phase clears the browser's session token and documents that existing tokens remain valid until expiration.

## How would you implement revocation?

Use short-lived access tokens, rotate refresh tokens, and revoke refresh-token families on logout or compromise. A token-version field or a bounded denylist can invalidate access tokens when the risk justifies the lookup and state-management cost.

## How is the admin endpoint protected?

The route applies `authenticate` first and `requireRole('ADMIN')` second. Middleware order ensures an unauthenticated caller receives `401`, while an authenticated customer receives `403`.

## How does the frontend know if a user is authenticated?

The frontend keeps the access token in `sessionStorage`, calls `/api/v1/auth/me` on startup, and stores only the safe user object in React state. Logout clears the token and state. This is a deliberately documented tradeoff; secure HttpOnly cookies would reduce JavaScript token exposure in a production browser deployment.

## Why use service/repository architecture for the catalog?

Controllers translate HTTP requests, services enforce business rules, and repositories isolate Prisma. This keeps catalog rules testable with in-memory repositories and prevents route handlers from becoming database-heavy.

## Why use Prisma?

Prisma provides typed access to the existing PostgreSQL schema, explicit relations, and safe query construction. Phase 4 uses it for category relationships, pagination, filters, and aggregate counts.

## How does pagination work?

The product repository uses offset pagination with `skip = (page - 1) * limit` and `take = limit`, alongside a count query. The API returns total items and total pages. Cursor pagination would scale better for very large or rapidly changing lists but is less convenient for this interview-sized catalog API.

## How are arbitrary sort fields prevented?

The Zod query schema only accepts `name`, `price`, `stock`, or `createdAt`. The validated value is then used to build Prisma's `orderBy`; arbitrary request strings never reach the query.

## Why cannot customers create products?

Product mutations are protected by verified JWT authentication followed by `requireRole('ADMIN')`. The API never trusts a role supplied by the frontend.

## What happens when deleting a product referenced by an order?

The Prisma schema uses a restrictive `OrderItem.productId` foreign key. The service translates the resulting constraint error to `409 Product cannot be deleted because it is referenced by order history`, preserving historical orders.

## Why search in PostgreSQL now?

The current catalog is small enough for a case-insensitive Prisma/PostgreSQL name filter. OpenSearch can later provide relevance ranking, analyzers, and scalable search without complicating this phase.

## How would Redis improve product performance later?

Redis caches category lists, product details, and repeated product-list queries with short TTLs and explicit prefix invalidation after admin mutations. It is fail-open and never replaces PostgreSQL as the source of truth.

## Why Redis?

CloudCart uses Redis to reduce repeated PostgreSQL reads for public catalog responses. The cache-aside layer is optional and fail-open.

## What are cache hits and misses?

A hit returns valid JSON already stored under the deterministic key. A miss, expired entry, malformed value, or unavailable Redis causes the service to query PostgreSQL and attempt to repopulate Redis.

## Why use TTLs?

TTL bounds stale catalog data and ensures abandoned cache entries disappear. Product lists default to 60 seconds, while details and categories default to 300 seconds through environment configuration.

## What happens when a product changes?

The service deletes the product detail key and invalidates only the product-list prefix. Category mutations also invalidate category keys and product-list caches.

## Why not FLUSHALL?

`FLUSHALL` would remove unrelated keys and is unsafe in a shared Redis instance. Prefix invalidation keeps the catalog cache scoped.

## Why must query parameters be in list keys?

Page, filters, search, and sorting change the response. The key utility serializes every validated parameter so page 1 cannot return page 2 or another category's results.

## What if Redis goes down?

Redis methods catch connection and command failures. Services continue with PostgreSQL, and successful writes remain successful even if invalidation cannot run. The health endpoint reports Redis separately from application health.

## What is cache stampede?

It occurs when many requests miss or expire together and all query PostgreSQL. The current implementation keeps the design simple; a future version could add short locking, request coalescing, or stale-while-revalidate behavior.

## Redis versus other storage

Redis is shared, network-accessible cache state with TTL and eviction support. An in-memory application cache is faster but isolated per process. Browser storage is client-controlled and unsuitable as the authoritative catalog. PostgreSQL remains durable source-of-truth data.

## How would Redis work in AWS?

The same `REDIS_URL` contract can point to private Amazon ElastiCache for Redis/Valkey-compatible infrastructure. It should use private networking, security groups, credentials, monitoring, and capacity planning. CloudCart has not deployed ElastiCache.

## What happens after a cache restart?

The cache is empty, so requests miss, read PostgreSQL, and rebuild entries. No business data is lost because Redis is not authoritative.

## How would you monitor Redis?

Track connection health, hit/miss ratios, latency, memory/eviction metrics, command errors, and PostgreSQL fallback volume. The current API exposes a lightweight Redis dependency status through `/health`.

## How would S3 replace image URLs later?

The current API accepts an image URL field. A later S3 phase would issue signed upload URLs, store the resulting object URL/key, and keep binary media outside PostgreSQL.

## Why S3 instead of PostgreSQL for images?

S3 is designed for durable object storage and keeps binary data out of relational rows. CloudCart stores only an `s3://` reference in `Product.imageUrl`.

## How are image keys generated and validated?

The backend generates `products/<product-id>/<random-id>.<extension>` keys and validates MIME type, extension, and a 5 MB limit. Original filenames are not trusted.

## What happens when replacing an image?

The new object is uploaded first, the database reference is updated, caches are invalidated, and the old object is deleted. If the database update fails, the new object is cleaned up.

## Why SQS?

SQS decouples post-checkout processing from the synchronous order response. CloudCart commits the PostgreSQL order transaction first, then publishes a minimal `ORDER_CREATED` event.

## What happens if the API transaction succeeds but SQS fails?

The order remains successful and the publish failure is logged. A future transactional Outbox Pattern would persist the event with the order and retry publication reliably.

## How does the worker handle duplicates and failures?

The worker validates events, tracks processed order IDs during its lifetime, publishes to SNS, and deletes only after successful processing. Failed SNS publication leaves the SQS message for retry.

## Why SNS after SQS?

SQS provides durable work delivery to the worker; SNS provides fan-out to future independent subscribers after processing. React never accesses either service.

## What happens if AWS is unavailable?

Normal startup, tests, catalog, cart, and order database behavior continue without AWS configuration. Image upload returns a safe configuration error when invoked. SQS publication does not undo a committed order, and worker failures leave messages retryable.

## How would the worker scale?

Run multiple worker processes against the same queue, use visibility timeouts and a dead-letter queue, and make processing idempotent. SNS subscribers can scale independently.

## Why use a database transaction for order creation?

Checkout creates the order, snapshots items, decrements stock, and clears the cart. A Prisma PostgreSQL transaction ensures those changes commit together or roll back together.

## What happens if checkout fails halfway?

The transaction throws and PostgreSQL rolls back the order, order items, stock changes, and cart clearing. The customer retains the cart and no partial order is returned.

## How is negative stock prevented?

Checkout validates current stock and performs conditional `updateMany` operations with `stock >= quantity`. A failed conditional update raises a conflict instead of decrementing below zero.

## Why not reserve stock when adding to cart?

This phase keeps carts as intent rather than reservations. Reserving at add-to-cart would require expiry, release, and concurrency machinery. Checkout rechecks stock immediately before its transaction.

## Why store priceAtPurchase?

Product prices can change after a purchase. `OrderItem.priceAtPurchase` preserves the historical price used for each line and keeps old totals accurate.

## How are customer orders protected?

The order repository receives the verified JWT user id and queries by both `orderId` and `userId`. Another customer's order therefore returns `404` rather than leaking existence.

## How does admin order management work?

Admin routes apply `authenticate` and `requireRole('ADMIN')`, then support paginated listing, details, and validated status transitions. Customers cannot access these routes.

## Why is the backend the cart source of truth?

The database contains current quantities and product stock. The frontend reloads cart state from the API, so browser storage cannot bypass stock checks or ownership rules.

## How would concurrent purchases be improved?

The current PostgreSQL transaction and conditional stock update protect the decrement, but a larger system could add reservation records, stronger isolation, and an inventory workflow. SQS could process fulfillment asynchronously after an order is committed.

## How could Redis, SQS, and SNS help later?

Redis caches catalog reads, SQS decouples committed order events from worker processing, and SNS fans out successfully processed events. These services are now implemented as optional integrations.

## Why ECS Fargate?

Fargate runs the existing backend and worker containers without managing EC2 hosts. The API and worker can scale as separate services with different networking and capacity needs.

## Why ECR?

ECR stores versioned backend, worker, and frontend images close to ECS. Deployments reference immutable image tags rather than rebuilding on the task host.

## Why ALB?

The ALB provides the public HTTPS entry point, routes only to the backend ECS service, and uses `/health` to remove unhealthy tasks. The worker has no public listener.

## Why RDS and ElastiCache?

RDS provides managed PostgreSQL for the Prisma source of truth. ElastiCache provides private Redis for the existing optional cache-aside layer. Neither database is publicly exposed.

## Why IAM task roles?

ECS task roles avoid static credentials in images and grant only the backend or worker permissions they need. The backend policy covers S3, SQS send, and SNS publish; the worker policy covers SQS receive/delete and SNS publish.

## Why CloudWatch?

The ECS `awslogs` driver collects backend and worker output centrally. It supports troubleshooting startup, order-event, AWS integration, and worker failures without logging secrets.

## Why not EC2?

Fargate removes host patching and capacity management for this interview-scale architecture. EC2 could provide more control, but would add operational responsibility.

## How does a request reach Node.js?

The browser calls the deployed API origin. HTTPS reaches the public ALB, the ALB forwards to healthy backend tasks on port 4000, and the API accesses private RDS, ElastiCache, S3, and SQS through task networking and IAM.

## How does an order become asynchronous?

The existing PostgreSQL checkout transaction commits first. The API then publishes `ORDER_CREATED` to SQS. The private worker consumes it and publishes to SNS; the API response does not wait for worker processing.

## What happens if a container crashes?

ECS replaces unhealthy API tasks and the ALB routes around them. A worker restart can receive the same SQS message again, so processing is designed for duplicate delivery and messages are not deleted before successful processing.

## How are deployment secrets secured?

`DATABASE_URL` and `JWT_SECRET` should come from Secrets Manager or SSM references in the ECS task definition. AWS API access uses task roles. No secrets are copied into Docker images or exposed to React.

## How would CloudCart scale?

Scale backend ECS tasks behind the ALB, scale workers based on SQS depth/age, use RDS sizing/read strategies, use ElastiCache for hot catalog reads, and keep S3 for media. CloudWatch alarms and deployment circuit breakers provide operational feedback.
