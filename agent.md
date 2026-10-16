# Project Deployment Status

**Current task:** Task 3–4 + workflow — Dockerfile, `.dockerignore`, ECR workflow — **COMPLETE** (local `docker build` is yours)  
**Next task:** Task 5 — Environment configuration review (`.env.example` already exists; confirm grouping).

---

## Current Deployment Architecture

**Target (now documented and files in repo):**

```text
Internet → ALB → EC2:3000 → Docker Next.js only
                         → Neon / Redis / S3 / Resend (all external)
```

**Live today:** PM2 VPS until GitHub `ENABLE_DOCKER_DEPLOY=true` (and ECR vars set).

**You build locally:**

```bash
docker build --progress=plain --build-arg APP_URL=http://localhost:3000 -t homyz:local .
docker run --rm --env-file .env -p 3000:3000 homyz:local
```


---

## Architecture

Homyz is a **Next.js 16 App Router** travel/hospitality app.

```text
WEB (NextAuth JWT cookie)                 MOBILE (Bearer jose JWT)
RSC / SSR pages / Server Actions          /api/v1/* JSON
        │                                          │
        └────────────────┬─────────────────────────┘
                         ▼
              lib/permissions + services/*.service.ts
                         ▼
         Prisma 7 + @prisma/adapter-pg  →  EXTERNAL PostgreSQL (Neon)
                         ▼
              Redis (optional, EXTERNAL)     S3 (optional/prod, EXTERNAL)
              Resend email                   Twilio SMS
              Google / Facebook / Apple OAuth
```

- **Pages Router:** not used (no `pages/`).
- **Request proxy:** `proxy.ts` (Next.js 16; not `middleware.ts`). Optimistic redirects only; real auth is in page guards, route handlers, and services.
- **No cron/workers.** Compliance expiration is an authenticated on-demand POST.
- **No `NEXT_PUBLIC_*` variables.** Secrets stay server-side.

---

## Current Deployment Architecture

**Live today (until flags change):** GitHub Actions `validate` then **self-hosted VPS + PM2**:

```text
push main → GitHub validate (Node 22, npm ci, next build)
         → self-hosted runner
              git sync → /var/www/html/Homyz
              malware scan
              npm ci/install + next build
              PM2 "Homyz" → npm start -H 0.0.0.0 -p 3000
```

**Prepared but not cut over:** EC2 host Node (`ENABLE_EC2_DEPLOY=true`) via `scripts/deploy/release.sh` + systemd `deploy/homyz.service`. **No Next.js Docker image exists** (`Dockerfile` was removed). `docker-compose.prod.yml` currently defines **Redis only** (must not be used as the production Redis; Redis stays external).

**Target (this program of work):**

```text
Internet → AWS ALB (HTTPS/ACM) → Target Group :3000
       → EC2 (SG: 3000 from ALB only)
            → Docker → Next.js ONLY
                 → DATABASE_URL     Neon / external Postgres (NOT in Docker)
                 → REDIS_URL        external Redis (NOT in Docker)
                 → S3_BUCKET        external S3 (NOT in Docker)
                 → RESEND / Twilio / OAuth (NOT in Docker)
```

---

## Deployment dependency table

| Service | Location | Docker? |
| --- | --- | --- |
| Next.js application | EC2 | **YES** (only thing to containerize) |
| PostgreSQL | External Neon (`DATABASE_URL`); RDS later via same URL | **NO** |
| Redis | External `REDIS_URL` (optional) | **NO** |
| S3 / media | External AWS S3 (`S3_BUCKET`) | **NO** — never copy uploads into the image |
| Email | External Resend (`RESEND_API_KEY`) | **NO** |
| SMS | External Twilio | **NO** |
| OAuth | Google / Facebook / Apple | **NO** |
| Maps CSS | unpkg Leaflet (browser) | **NO** |
| Font Awesome | cdnjs (browser) | **NO** |
| Prisma migrations | Explicit CI/ops (`prisma migrate deploy`) | **NO** auto-run on container start |

---

## Next.js

| Item | Finding |
| --- | --- |
| Next.js | **16.3.3** |
| React | **19.2.8** |
| Next engines | `node >= 20.9.0` (from `node_modules/next`) |
| `package.json` engines | **`>=22`** (required: `nanoid@6` needs Node 22+) |
| CI Node | **22** |
| Router | **App Router only** |
| `output: "standalone"` | **Already set** in `next.config.ts` — compatible with Next 16; appropriate for Docker |
| Build | `npm run build` / `build:ci` → `next build` |
| Start | `npm start` → `next start` (defaults **0.0.0.0:3000**; `PORT` / `HOSTNAME`) |
| Standalone start | `node .next/standalone/server.js` after copying `public` + `.next/static` |
| SSR | Yes — protected layouts call `requirePageUser()`; many `app/(protected)/**/page.tsx` |
| API routes | ~91 handlers under `app/api/` including `/api/v1/*` and NextAuth |
| Server Actions | Yes — `actions/auth|user|host|admin` (~15 files) |
| Middleware | `proxy.ts` (Next 16 proxy convention) |
| Image optimization | Enabled; remotePatterns for Google, Facebook, Unsplash, `*.amazonaws.com`, `*.cloudfront.net` |
| Static assets | `public/` + hashed `.next/static` |
| Filesystem-dependent | **Yes if `S3_BUCKET` unset:** writes `public/uploads/{listing-photos,stamp-icons,host-documents}`. Production Docker **must** set S3 so media is not on the container disk. |
| Package manager | **npm** is canonical (`package-lock.json`, CI `npm ci`). `pnpm-lock.yaml` still exists (conflict; do not switch managers). |
| Tests | `__tests__/` custom scripts; **no `npm test`**. CI does not run them. |
| Lint | `npm run lint` exists; **not** in current CI validate job |

---

## Database

| Item | Finding |
| --- | --- |
| Provider | PostgreSQL via **`DATABASE_URL` only** (Neon in production; no Neon SDK) |
| ORM | Prisma **7.10.0**, generator `prisma-client` → `generated/prisma` |
| Driver | `@prisma/adapter-pg` (required; no query-engine binary) |
| CLI config | `prisma7.config.ts` (dotenv for CLI) |
| Migrations | `prisma/migrations/` — two additive migrations. Script `db:migrate` = **`prisma migrate dev`** (dev only). `db:migrate:deploy` = **`prisma migrate deploy`**. |
| When migrations run | **Not** on `next build` or container start. Optional GitHub job if `RUN_DB_MIGRATE=true`. |
| Startup | Process **throws** if `DATABASE_URL` is missing (`lib/db/prisma.ts`). |

**Docker must not include PostgreSQL.**

---

## Redis

| Item | Finding |
| --- | --- |
| Client | `ioredis` **optionalDependency** |
| Config | `REDIS_URL` (`redis://` or `rediss://`), `REDIS_ENABLED` (default true) |
| Required? | **No.** Unconfigured, package missing, or down → cache bypass, app continues |
| Startup | Does **not** crash if Redis is down |
| Login rate limit | NextAuth `assertLoginRateLimit` is **in-memory per process**; async path can use Redis |
| Compose | `docker-compose.prod.yml` currently runs Redis locally — **do not use this as production Redis.** Production Redis stays external. |

---

## Media / S3

| Item | Finding |
| --- | --- |
| Implementation | `lib/storage/media.ts` — `@aws-sdk/client-s3` |
| Path | Uploads go **through Next.js** (API/service `PutObject`), not browser direct-to-S3 |
| Enable | `S3_BUCKET` set |
| Region | `S3_REGION` or `AWS_REGION` (default `us-east-1`) |
| Public URL | `S3_PUBLIC_BASE_URL` or virtual-hosted `https://{bucket}.s3.{region}.amazonaws.com` |
| Credentials | Instance role preferred; else `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` |
| Custom endpoint | **None** today (not generic MinIO/R2 endpoint yet) |
| Prefixes | `listing-photos/`, `stamp-icons/` (public URLs); `host-documents/` (private; served via authenticated API) |
| Fallback | Local `public/uploads/**` if bucket unset — **unsafe for Docker/multi-EC2** |

Never copy media into the Docker image.

---

## Email and other APIs

| Service | Vars | Notes |
| --- | --- | --- |
| Resend | `RESEND_API_KEY`, `EMAIL_FROM` | HTTP API (SDK). No key: console in dev, warn in prod |
| Twilio SMS | `TWILIO_*` | REST; optional |
| Google/Facebook/Apple OAuth | client id+secret pairs | Env-gated; skipped if unset |
| nodemailer | declared | NextAuth peer; send path is Resend |
| Leaflet / Font Awesome / next/font | none | Browser/CDN or build-time fonts |

---

## Environment Variables

**Required at runtime**

| Variable | Source in production |
| --- | --- |
| `DATABASE_URL` | Secrets Manager / SSM / EC2 `.env` (Neon) |
| `NEXTAUTH_SECRET` | same |
| `JWT_ACCESS_SECRET` | same |
| `JWT_REFRESH_SECRET` | same |

**Strongly recommended for Docker + ALB**

| Variable | Purpose |
| --- | --- |
| `APP_URL` / `NEXTAUTH_URL` | Public HTTPS origin (emails, OAuth, Server Action allow-list **at image build**) |
| `SERVER_ACTION_ALLOWED_ORIGINS` | Extra hosts baked at **build** |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Shared across instances |
| `S3_BUCKET` (+ region / public base URL) | Durable media |
| `HOSTNAME=0.0.0.0` `PORT=3000` | Container listen |

**Optional**

`REDIS_*`, `RESEND_*`, `TWILIO_*`, OAuth keys, `ADMIN_*` (seed only), `AWS_ACCESS_KEY_ID`/`SECRET` (prefer instance role).

**None are `NEXT_PUBLIC_*`.** Do not bake secrets into the image. `.env.example` exists and is git-tracked (`!.env.example`). Never commit `.env` / `.env.production`.

---

## Authentication

- Web: NextAuth v4, **JWT** sessions (no sticky sessions required)
- Mobile: jose HS256 access + refresh
- Credentials + env-gated OAuth
- `ALLOW_DEMO_SOCIAL` / dev ADMIN impersonation must stay off in production

---

## Health checks (already present)

| Path | Role |
| --- | --- |
| `GET /api/health` | `{ "status": "ok" }` — liveness; **use for ALB** (no DB/Redis) |
| `GET /api/ready` and `GET /api/v1/health` | Readiness: Postgres required, Redis optional |

---

## AWS Resources Required (not provisioned in this task)

| Resource | Role |
| --- | --- |
| ECR | Immutable tags `homyz:<git-sha>` |
| EC2 | Docker Engine only for the Next.js container |
| ALB + ACM + target group | HTTPS terminate; health `/api/health` on port 3000 |
| Security groups | Internet → ALB 80/443; ALB → EC2:3000; no public 3000/5432/6379 |
| IAM | GitHub OIDC → ECR push; EC2 role → ECR pull + S3 |
| Neon (existing) | `DATABASE_URL` |
| External Redis | `REDIS_URL` if used |
| S3 bucket | Media prefixes as above |

Do not invent account IDs, IPs, or ECR URLs.

---

## Docker Configuration

| Item | Status |
| --- | --- |
| `Dockerfile` | Multi-stage, Node 22, npm lockfile, standalone, non-root, no secrets |
| `.dockerignore` | Present |
| Compose | **App container only** — no Postgres/Redis in Compose |
| Image tags | `<git-sha>` + optional `latest` |

## CI/CD Configuration

`.github/workflows/deploy.yml`:

1. `validate` — scan, `npm ci`, `next build`
2. `migrate` — optional `prisma migrate deploy`
3. `docker` — build/push ECR when `ECR_REGISTRY` + `ECR_REPOSITORY` are set (OIDC)
4. `deploy-ec2` — pull + health switch when `ENABLE_DOCKER_DEPLOY=true`
5. `deploy` — existing PM2 VPS until Docker deploy is enabled

## Completed Tasks

1. Production Deployment Audit
2–4. Standalone already on; Dockerfile + `.dockerignore` added
13–14. Workflow + `scripts/deploy/release.sh` / `rollback.sh` for Docker

## Next Task

Task 5 — Environment configuration review (optional polish of `.env.example`). Then local `docker build` by you.


## Files created / modified (this pass)

Created: `Dockerfile`, `.dockerignore`  
Updated: `.github/workflows/deploy.yml`, `docker-compose.prod.yml`, `scripts/deploy/release.sh`, `scripts/deploy/rollback.sh`, `docs/deployment.md`, `agent.md`

## Pending Tasks

5. Environment configuration review  
6. Health endpoint already exists — confirm in container after your build  
7. Docker runtime vs Neon/Redis/S3 (you run locally)  
8–12. ALB / SG / ECR account setup (docs; no invented AWS IDs)  
15–25. Low-downtime multi-EC2, performance, logs, final checklist  

## Validation Results

- Dockerfile: Node 22, npm `package-lock.json`, standalone, non-root, no `.env` COPY, no Postgres/Redis  
- Workflow: ECR push gated on `ECR_REGISTRY`/`ECR_REPOSITORY`; EC2 Docker deploy gated on `ENABLE_DOCKER_DEPLOY`  
- **`docker build` not run here** — you will build it  

## Known Issues / deployment risks

1. Dual lockfiles; Docker uses **npm**.  
2. First `npm ci` in Docker can take several minutes — use `--progress=plain`.  
3. Set `S3_BUCKET` in production.  
4. Pass `--build-arg APP_URL=...` for Server Actions.  
5. Single-EC2 switch has a short gap while port 3000 is rebound.  
6. Lint/unit tests still not in CI.

## Rollback Procedure

`HOMYZ_IMAGE=<previous ECR uri:sha> bash /opt/homyz/scripts/deploy/rollback.sh` (uses `.image-previous`).

## Next Task

You: local `docker build`. Then Task 5 env review / Task 7 container smoke test.