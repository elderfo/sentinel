# Sentinel — Local Development Guide

This guide covers everything needed to run the full Sentinel stack locally
using Docker Compose.

---

## Prerequisites

| Tool | Minimum version | Install |
|------|----------------|---------|
| Docker Desktop (or Docker Engine + Docker Compose plugin) | 24.x | https://docs.docker.com/get-docker/ |
| Node.js | 20.x | https://nodejs.org/ |
| pnpm | 10.x | `corepack enable && corepack prepare pnpm@latest --activate` |

Docker Compose V2 (`docker compose` — no hyphen) is required. Verify with:

```sh
docker compose version
```

---

## Quick Start

```sh
# 1. Clone the repository
git clone https://github.com/elderfo/sentinel.git
cd sentinel

# 2. Create your local environment file
cp .env.example .env
# Edit .env if any default ports conflict with services already on your machine.

# 3. Start the full stack
docker compose up
```

The stack is ready when you see health checks pass for all services. Open your
browser to http://localhost:8080 for the web UI or send requests to
http://localhost:3000 for the API.

---

## Service Architecture

```
                          ┌──────────────────────────────────────────┐
                          │              Docker network               │
                          │                                           │
  Browser         ──────► │  web :8080  ──────────► api :3000        │
  (localhost:8080)         │                         │    │           │
                          │                         │    │           │
  curl / API client──────► │              ┌──────────┘    │           │
  (localhost:3000)         │              │               │           │
                          │           postgres:5432   redis:6379      │
                          │           (persistent)    (ephemeral)     │
                          │              ▲               ▲            │
                          │              │               │            │
                          │         browser-worker ──────┘            │
                          │         (Playwright)                       │
                          └──────────────────────────────────────────┘

  Host port mappings (defaults):
    3000  →  api
    8080  →  web
    5432  →  postgres
    6379  →  redis
```

### Service descriptions

| Service | Image / Build target | Responsibility |
|---------|---------------------|----------------|
| `api` | Dockerfile `target: api` | Sentinel API server; domain logic in `packages/core` |
| `web` | Dockerfile `target: web` | Sentinel web UI; built from `packages/web` |
| `browser-worker` | `mcr.microsoft.com/playwright:v1.50.0-noble` | Headless browser automation; executes QA scenarios |
| `redis` | `redis:7-alpine` | Job queue and short-lived cache; ephemeral by default |
| `postgres` | `postgres:16-alpine` | Primary persistent datastore; data survives restarts |

---

## Environment Variables

All variables are documented and defaulted in `.env.example`. A minimal `.env`
for local development needs no changes — the defaults wire all services
together using Docker's internal DNS.

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Runtime environment |
| `LOG_LEVEL` | `info` | Structured log level (`trace` / `debug` / `info` / `warn` / `error`) |
| `API_PORT` | `3000` | Host port for the API |
| `API_URL` | `http://api:3000` | Internal API URL used by web and browser-worker |
| `WEB_PORT` | `8080` | Host port for the web UI |
| `DATABASE_URL` | `postgresql://sentinel:sentinel@postgres:5432/sentinel` | PostgreSQL connection string |
| `POSTGRES_USER` | `sentinel` | PostgreSQL superuser |
| `POSTGRES_PASSWORD` | `sentinel` | PostgreSQL password — **change in production** |
| `POSTGRES_DB` | `sentinel` | PostgreSQL database name |
| `POSTGRES_PORT` | `5432` | Host port for PostgreSQL |
| `REDIS_URL` | `redis://redis:6379` | Redis connection string |
| `REDIS_PORT` | `6379` | Host port for Redis |

---

## Common Commands

### Start and stop

```sh
# Start all services in the foreground (shows aggregated logs)
docker compose up

# Start all services in the background
docker compose up -d

# Stop all services (preserves volumes)
docker compose down

# Stop all services and remove volumes (full reset)
docker compose down -v
```

### Rebuild images

```sh
# Rebuild all images and restart
docker compose up --build

# Rebuild a specific service without restarting others
docker compose build api
```

### View logs

```sh
# Tail logs for all services
docker compose logs -f

# Tail logs for a specific service
docker compose logs -f api

# Show the last 100 lines for a service
docker compose logs --tail=100 web
```

### Open a shell in a running container

```sh
# Shell into the API container
docker compose exec api sh

# Shell into the web container
docker compose exec web sh

# Shell into the PostgreSQL container (psql)
docker compose exec postgres psql -U sentinel -d sentinel

# Shell into the Redis container (redis-cli)
docker compose exec redis redis-cli
```

### Run one-off commands

```sh
# Run a pnpm command inside the build context without a running service
docker compose run --rm api node --version

# Run database migrations (adjust path once migrations are implemented)
docker compose run --rm api node packages/core/dist/migrate.js
```

---

## Troubleshooting

### Port already in use

If a port conflict prevents services from starting, override the host port in
`.env`:

```sh
# In .env
API_PORT=3001
WEB_PORT=8081
POSTGRES_PORT=5433
REDIS_PORT=6380
```

Then restart the stack: `docker compose up`.

### Service fails health check

Check the service logs for errors:

```sh
docker compose logs api
```

If the issue is a missing database connection, ensure `postgres` is healthy
first:

```sh
docker compose ps
```

### Stale build cache

If a code change is not reflected in the running container:

```sh
docker compose up --build
```

To force a full rebuild without any cached layers:

```sh
docker compose build --no-cache
docker compose up
```

### Browser-worker can't reach the API

Verify the API service is healthy:

```sh
docker compose ps
```

The browser-worker connects to the API using Docker's internal DNS
(`http://api:3000`). This name resolves only within the Docker network — it
is not accessible from the host.

### PostgreSQL data loss after `docker compose down -v`

`docker compose down -v` removes the `postgres_data` named volume. Use
`docker compose down` (without `-v`) to preserve data between sessions.

### Inspect a built image

```sh
docker image ls sentinel/api:local
docker inspect sentinel/api:local
```
