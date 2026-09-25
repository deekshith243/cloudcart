# Products and Categories

## Architecture

Phase 4 follows `route -> controller -> service -> repository -> Prisma`. Controllers parse HTTP input and shape responses. Services own category existence, uniqueness, deletion, and pagination behavior. Repositories are the only layer that issues Prisma queries.

## Category API

Public:

- `GET /api/v1/categories`
- `GET /api/v1/categories/:id`

Admin-only mutations:

- `POST /api/v1/categories` with `{ name, description? }`
- `PUT /api/v1/categories/:id` with `{ name, description? }`
- `DELETE /api/v1/categories/:id`

Names are unique. A category referenced by products cannot be deleted; the API returns `409` instead of breaking catalog relationships.

## Product API

Public:

- `GET /api/v1/products`
- `GET /api/v1/products/:id`

Admin-only mutations:

- `POST /api/v1/products` with `name`, `description`, `price`, `stock`, `imageUrl?`, and `categoryId`
- `PUT /api/v1/products/:id` with the same editable fields
- `DELETE /api/v1/products/:id`

The product and category UUIDs, timestamps, and database relationships are server-controlled. Products use a compound category/name uniqueness rule. Product deletion relies on the restrictive Prisma `OrderItem` relationship and returns `409` when order history references the product.

## Listing

`GET /api/v1/products` supports:

- `page` and `limit` pagination, with `limit` capped at 100
- `categoryId`
- `minPrice` and `maxPrice`
- `inStock=true|false`
- case-insensitive PostgreSQL name search with `search`
- whitelisted `sortBy=name|price|stock|createdAt`
- `sortOrder=asc|desc`

The response includes `items` and `{ page, limit, totalItems, totalPages }`. Invalid UUIDs, ranges, sort fields, and pagination values return `400`.

Phase 4 intentionally uses PostgreSQL/Prisma filtering. OpenSearch can be introduced later for large-scale search and relevance ranking, and Redis can later cache popular catalog queries. Image URLs remain ordinary fields until the S3 phase.

## Authorization

Public reads do not require a token. Every mutation uses the existing verified JWT middleware followed by `requireRole('ADMIN')`; frontend role state is never trusted by the API.
