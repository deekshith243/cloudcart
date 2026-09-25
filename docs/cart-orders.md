# Cart and Orders

## Cart Architecture

Cart routes use the verified JWT user id and never accept a frontend `userId`. The controller parses input, `CartService` validates product existence and current stock, and `CartRepository` scopes every item operation through the authenticated user's cart.

- `GET /api/v1/cart`
- `POST /api/v1/cart/items`
- `PUT /api/v1/cart/items/:itemId`
- `DELETE /api/v1/cart/items/:itemId`
- `DELETE /api/v1/cart`

Adding a product does not reserve inventory. It only records intent in the database. Stock is checked again during checkout.

## Checkout Transaction

`POST /api/v1/orders` calls `PrismaOrderRepository.createFromCart`, which uses one PostgreSQL/Prisma `$transaction` to:

1. Load the authenticated user's cart and current product stock.
2. Reject an empty cart or insufficient stock.
3. Snapshot current product prices and calculate the Decimal total.
4. Conditionally decrement each product with `stock >= quantity`.
5. Create the order and order items with `PENDING` status.
6. Clear the cart items.

Any thrown error rolls back the entire transaction. Conditional stock updates prevent a committed decrement from making stock negative. Under concurrent purchases, PostgreSQL row/update behavior protects the condition, but this is not a distributed inventory reservation system.

A future reservation or fulfillment design could use inventory holds and SQS-backed processing. Those services are intentionally not implemented in Phase 5.

## Price Snapshot

Each `OrderItem.priceAtPurchase` is copied from the current product price during checkout. Order totals and historical detail responses use that snapshot, never the current `Product.price`.

## Order API

Customer routes:

- `POST /api/v1/orders`
- `GET /api/v1/orders?page=1&limit=10`
- `GET /api/v1/orders/:id`

Admin routes:

- `GET /api/v1/admin/orders?page=1&limit=20&status=PENDING`
- `GET /api/v1/admin/orders/:id`
- `PATCH /api/v1/admin/orders/:id/status`

Customer order queries are scoped by `userId`. An order belonging to another customer is returned as `404` to avoid leaking existence. Admin routes require the existing verified JWT and `ADMIN` role.

## Status Transitions

Allowed transitions are:

- `PENDING -> PROCESSING` or `CANCELLED`
- `PROCESSING -> SHIPPED` or `CANCELLED`
- `SHIPPED -> DELIVERED`
- `DELIVERED` and `CANCELLED` are terminal

Invalid transitions return `409`. Status values are validated with Zod.

## Frontend

The frontend provides `/cart`, `/orders`, `/orders/:id`, `/admin/orders`, and admin order details. Cart state is loaded from the backend and is not stored as an authoritative localStorage value. Checkout disables submission while in progress and redirects to order details after success.
