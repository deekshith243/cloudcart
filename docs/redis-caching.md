# Redis Caching

## Purpose

Redis is a performance layer for frequently accessed catalog reads. PostgreSQL remains the source of truth for products and categories. The frontend does not know whether a response came from Redis or PostgreSQL.

## Cache-Aside Flow

Product and category services:

1. Build a deterministic key.
2. Try Redis `GET`.
3. Return valid cached JSON on a hit.
4. Query PostgreSQL on a miss or malformed value.
5. Store the response with a configurable TTL.

Redis failures are fail-open. Cache methods catch connection/read/write errors, log a concise warning, and allow the service to use PostgreSQL.

## Keys and TTLs

- `catalog:products:list:<normalized query>` includes every pagination, filter, search, and sort parameter.
- `catalog:product:<id>` caches product details.
- `catalog:categories` caches the category list.
- `catalog:category:<id>` caches category details.

Configuration is provided through `REDIS_URL`, `REDIS_PRODUCT_TTL_SECONDS`, `REDIS_PRODUCT_LIST_TTL_SECONDS`, and `REDIS_CATEGORY_TTL_SECONDS`. Defaults are 300 seconds for details/categories and 60 seconds for product lists, limiting staleness while avoiding repeated catalog queries.

## Invalidation

Product mutations delete the exact product detail key and scan/delete only the `catalog:products:list:` prefix. Category mutations delete the category list/detail keys and product-list prefix because category changes affect catalog results. The implementation never uses `FLUSHALL`, which could remove unrelated keys and become dangerous in a shared Redis instance.

A successful PostgreSQL write is never rolled back because invalidation failed. This creates a small eventual-consistency window, bounded by TTL, and keeps the database authoritative.

## Local Development

Redis is defined in Docker Compose:

```powershell
docker compose up -d redis
docker compose ps
docker compose logs redis
```

The official `redis:7-alpine` image exposes port `6379` and has a `redis-cli ping` health check. The backend uses `REDIS_URL=redis://localhost:6379` locally. Unit tests use an in-memory cache double and do not require Docker or Redis.

## Health and Operations

`GET /health` reports application status separately from cache status: `ok`, `unavailable`, or `disabled`. Redis is not a liveness prerequisite. Production Redis should be private and protected by a network/security group; credentials must remain environment configuration.

## Future AWS Mapping

Redis can later be replaced by Amazon ElastiCache for Redis/Valkey-compatible caching by changing `REDIS_URL` and deployment networking. ElastiCache has not been deployed by this project.
