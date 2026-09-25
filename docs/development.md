# Development

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop

## Install

Run `npm install` in the root, then run `npm install` in `frontend`, `backend`, and `worker`.

Copy `.env.example` to `.env` when backend configuration is needed. The local PostgreSQL URL is `postgresql://cloudcart:cloudcart@localhost:5432/cloudcart?schema=public`.

## Run

- `npm run dev:frontend` starts Vite on its printed local URL.
- `npm run dev:backend` starts the API on `http://localhost:4000`.
- `npm run dev:worker` starts the worker process.
- `docker compose up -d` starts local PostgreSQL and Redis.
- `docker compose up -d redis` starts only local Redis.
- `docker compose ps` shows service and health status.
- `docker compose logs redis` shows Redis logs.
- `npm --prefix backend run db:setup` generates Prisma, applies development migrations, and seeds local data.
- `npm run test` runs the backend authentication tests without requiring PostgreSQL.

## Prisma workflow

From the repository root, start PostgreSQL with `docker compose up -d postgres`. Then run `npm --prefix backend run prisma:validate` and `npm --prefix backend run prisma:generate` to validate and generate the client.

Create a new development migration with `npm --prefix backend run prisma:migrate -- --name describe-change`. Apply committed migrations in a deployment environment with `npm --prefix backend run prisma:migrate:deploy`. Seed the development admin, customer, categories, and products with `npm --prefix backend run prisma:seed`.

The development seed uses bcrypt hashes and is idempotent for its fixed email/name keys. Set `SEED_ADMIN_PASSWORD` and `SEED_CUSTOMER_PASSWORD` in the local environment before running it. Never reuse development credentials outside local development.

## Verify

Run `npm run test`, `npm run build`, `npm run lint`, and `npm run format:check` from the root. With the API running, open `http://localhost:4000/health` and expect a JSON status response. Authentication routes are documented in [authentication.md](authentication.md). Redis behavior is documented in [redis-caching.md](redis-caching.md). To verify database connectivity after Docker is available, run `npm --prefix backend run prisma:migrate:deploy` followed by `npm --prefix backend run prisma:seed`.
