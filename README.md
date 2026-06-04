# YEZZ

Bilingual DIY studio website and admin — **Next.js** (`apps/web`) + **Fastify API** (`apps/api`) + **PostgreSQL** (`packages/db`).

> **Important:** The public site reads live data from the API (`NEXT_PUBLIC_USE_API=true`). Before starting the web app, run **Postgres + migrations + seed** and keep **`pnpm dev:api`** running on port 4000. Otherwise project pages will fail or show empty data.

## Prerequisites

- Node.js 22+
- pnpm 10 (`corepack enable`)
- Docker (optional, for full stack)

## Quick start (local dev)

```bash
# 1. Clone and install
pnpm install

# 2. Environment
cp .env.example .env
# Ensure NEXT_PUBLIC_USE_API=true (default in .env.example)

# 3. Start Postgres + Redis (+ MinIO for uploads)
docker compose -f docker-compose.dev.yml up -d

# 4. Database
pnpm db:migrate
pnpm db:seed

# 5. Run API and web (two terminals)
pnpm dev:api    # http://localhost:4000
pnpm dev:web    # http://localhost:3000
```

**Default admin** (from seed): `admin@yezz.local` / `changeme` → http://localhost:3000/admin/login

**API docs**: http://localhost:4000/docs

**Health**: http://localhost:4000/health

## Full stack with Docker (one command)

```bash
cp .env.example .env
pnpm docker:up
```

Starts: Postgres, Redis, MinIO, **migrate + seed**, API (`:4000`), Web (`:3000`).

- Site: http://localhost:3000  
- Admin: http://localhost:3000/admin/login  
- API: http://localhost:4000  
- MinIO console: http://localhost:9001  

Stop: `pnpm docker:down`

## Monorepo scripts

| Script | Description |
|--------|-------------|
| `pnpm dev:web` | Next.js dev server |
| `pnpm dev:api` | Fastify API (watch) |
| `pnpm db:migrate` | Run Drizzle migrations |
| `pnpm db:seed` | Seed categories, projects, admin, etc. |
| `pnpm db:generate` | Generate migration from schema |
| `pnpm typecheck` | Typecheck all packages |
| `pnpm test:api` | API unit tests (Vitest) |
| `pnpm docker:up` | `docker compose up -d --build` |

## Project layout

```
yezz/
├── apps/
│   ├── api/          # Fastify REST API
│   └── web/          # Next.js site + /admin
├── packages/
│   └── db/           # Drizzle schema, migrations, seed
├── docker-compose.yml
├── docker-compose.dev.yml
└── docs/backend-migration/REQUIREMENTS.md
```

## Production deployment

### Database (Neon)

Use [Neon](https://neon.tech) PostgreSQL in production:

1. Create a Neon project and copy the **pooled** connection string.
2. Set on the API host (and for one-off migrate):

```env
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require
```

3. Run migrations against production (from CI or locally with env):

```bash
DATABASE_URL="postgresql://..." pnpm db:migrate
```

Neon notes:

- Prefer the **pooler** URL for the API runtime.
- Use a direct (non-pooler) URL only if you need long-running migration sessions.
- Enable SSL (`sslmode=require` is included in Neon URLs).

### Media storage (Cloudflare R2)

Development uses **MinIO** (S3-compatible). Production uses **R2** — same env names, different endpoints:

```env
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY=<R2_ACCESS_KEY_ID>
S3_SECRET_KEY=<R2_SECRET_ACCESS_KEY>
S3_BUCKET=yezz-media
S3_PUBLIC_URL=https://media.yourdomain.com
```

Steps:

1. Create an R2 bucket and API token in Cloudflare dashboard.
2. Map a custom domain (or R2 public URL) to `S3_PUBLIC_URL`.
3. Add that hostname to `apps/web/next.config.ts` → `images.remotePatterns` if using Next Image.
4. Remove or disable MinIO in production compose; API only needs the env vars above.

`forcePathStyle` is enabled in the API S3 client (works for MinIO and R2).

### API environment (production)

```env
DATABASE_URL=...
REDIS_URL=rediss://...          # e.g. Upstash / managed Redis
PORT=4000
CORS_ORIGIN=https://yourdomain.com
JWT_SECRET=<long-random-secret>
JWT_EXPIRES_IN=24h
NODE_ENV=production
S3_*=...                        # R2 — see above
RESEND_API_KEY=...
OWNER_EMAIL=...
```

### Web environment (production)

Build-time (Docker `ARG` or CI):

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_USE_API=true
```

## API overview

Base path: `/api/v1`

| Area | Examples |
|------|----------|
| Public | `GET /categories`, `/projects`, `/settings`, `POST /bookings`, `/cart-orders` |
| Auth | `POST /auth/login` |
| Admin (JWT) | `/admin/projects`, `/admin/bookings`, `/admin/orders`, … |

OpenAPI UI: **GET /docs**

## Testing

```bash
pnpm test:api
```

Covers cache/rate-limit helpers, email sanitization, and booking validation.

## Further reading

Migration requirements and progress: `docs/backend-migration/REQUIREMENTS.md`
