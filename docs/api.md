# CloudCart API

All routes use the `/api/v1` prefix.

## Authentication

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`

See [authentication.md](authentication.md).

## Categories

- `GET /categories`
- `GET /categories/:id`
- `POST /categories` (ADMIN)
- `PUT /categories/:id` (ADMIN)
- `DELETE /categories/:id` (ADMIN)

## Products

- `GET /products`
- `GET /products/:id`
- `POST /products` (ADMIN)
- `PUT /products/:id` (ADMIN)
- `DELETE /products/:id` (ADMIN)
- `POST /products/:id/image` (ADMIN, multipart field: `image`)

Product listing query parameters are `page`, `limit`, `categoryId`, `minPrice`, `maxPrice`, `inStock`, `search`, `sortBy`, and `sortOrder`.

## Admin

- `GET /admin/dashboard` (ADMIN)

Returns `totalProducts`, `totalCategories`, `productsInStock`, and `productsOutOfStock`. Order metrics are intentionally deferred to Phase 5.

## Customer

- `GET /customer/profile` (CUSTOMER or ADMIN)

## Cart

- `GET /cart` (authenticated)
- `POST /cart/items` (authenticated)
- `PUT /cart/items/:itemId` (authenticated)
- `DELETE /cart/items/:itemId` (authenticated)
- `DELETE /cart` (authenticated)

## Orders

- `POST /orders` (authenticated customer or admin)
- `GET /orders` (authenticated, own orders only)
- `GET /orders/:id` (authenticated, own order only)
- `GET /admin/orders` (ADMIN)
- `GET /admin/orders/:id` (ADMIN)
- `PATCH /admin/orders/:id/status` (ADMIN)
