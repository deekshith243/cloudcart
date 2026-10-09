# CloudCart

CloudCart is a production-style e-commerce and order management platform built for an AWS Developer interview.

## Phases 1 through 9

CloudCart now includes the React/Vite frontend, Express API, Prisma PostgreSQL schema, authentication, catalog management, cart/order workflows, Redis catalog caching, S3 product image boundaries, and SQS/SNS order-event boundaries. AWS services remain configuration-driven and unverified until deployed with real infrastructure.

See [docs/architecture.md](docs/architecture.md) and [docs/development.md](docs/development.md) for the current boundaries and commands.

## Local quick start

From PowerShell in the repository root:

```powershell
Copy-Item .env.example .env
npm install
npm --prefix frontend install
npm --prefix backend install
npm --prefix worker install
docker compose up -d postgres redis
npm --prefix backend run db:setup
```

Start the frontend, API, and optional idle worker in separate terminals:

```powershell
npm run dev:frontend
npm run dev:backend
npm run dev:worker
```

The frontend is served by Vite, the API is at `http://localhost:4000`, and PostgreSQL/Redis are provided by Docker Compose. AWS S3/SQS/SNS are optional for local catalog, cart, and order flows; the worker reports that it is idle when SQS is not configured.

Run the repository checks with `npm run test`, `npm run build`, `npm run lint`, and `npm run format:check`.
