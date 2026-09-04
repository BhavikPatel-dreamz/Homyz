# Homyz Production Deployment — Agent Status

This file is the handoff document for sequential production-deployment work.
**Do not start the next task until the current task is validated.**

---

## Deployment status

**Phase:** Task 1 complete (audit only). **Not deployment-ready.**

Current production path is **not** Docker + AWS EC2 + ALB. It is:

```text
GitHub (push to main)
  → GitHub Actions validate (ubuntu-latest, npm install + next build)
  → Self-hosted runner
       git sync → /var/www/html/Homyz
       malware scan
       npm install + npm run build
       PM2 process "Homyz" (npm start)
```

Target architecture (not yet implemented):

```text
Internet → AWS ALB (HTTPS/TLS) → EC2 (Docker) → Next.js container
                                              → Neon PostgreSQL (DATABASE_URL)
                                              → Redis (optional)
                                              → Resend / Twilio / OAuth
```

No Dockerfile, `.dockerignore`, `docker-compose*.yml`, ECR pipeline, or EC2/ALB docs exist yet.

---

## Task completed

### Task 1 — Production Deployment Audit

Inspected the repository, Next.js 16 docs (`node_modules/next/dist/docs/`), package manifests, Prisma, auth, env scripts, CI, and runtime services.

**No application code was changed.** This file (`agent.md`) was created.

---

## Files changed

| File | Change |
| --- | --- |
| `agent.md` | Created with Task 1 audit findings |

Unrelated local (pre-existing, not part of this task):

| File | Note |
| --- | --- |
| `.github/workflows/deploy.yml` | Uncommitted: adds malware scan to the GitHub `validate` job |
| `SECURITY-HOOK.md` | Uncommitted: documents scan-before-build on `main` |

---

## Architecture changes

None. Audit only.

---

## Configuration changes

None. Audit only.

---

## Validation performed

- Read `package.json`, lockfiles, `next.config.ts`, `prisma/schema.prisma`, `prisma7.config.ts`, `lib/db/prisma.ts`
- Read auth (`lib/auth/options.ts`, `lib/auth/tokens.ts`, `lib/auth/context.ts`, `app/api/auth/[...nextauth]/route.ts`)
- Read env catalog (`scripts/check-env.ts`, `scripts/check-env.js`, `.env.example`, `lib/env.ts`)
- Read Redis (`lib/redis/client.ts`, `lib/redis/config.ts`)
- Read health (`app/api/v1/health/route.ts`)
- Read CI (`.github/workflows/deploy.yml`)
- Confirmed Next.js 16.3.3 engines: `node >= 20.9.0`
- Confirmed `next start` default hostname is `0.0.0.0` (port `3000` / `PORT`)
- Confirmed `output: "standalone"` is supported by this Next.js version (`output.md`)
- Confirmed no Docker files, no Pages Router, no `instrumentation.ts`
- Confirmed `.env.example` exists on disk but is **gitignored** by `.env*`
- Did **not** copy secrets from `.env` into this file

---

# Audit findings

## 1. Current architecture

Homyz is a **Next.js App Router** travel/hospitality app with:

- SSR pages + Server Actions for web
- Versioned JSON API under `/api/v1/*` for future mobile clients
- Shared service layer (`services/*.service.ts`) behind both surfaces
- PostgreSQL via Prisma 7 + `@prisma/adapter-pg`
- NextAuth JWT sessions (web cookie) + jose HS256 access/refresh (mobile)

```text
WEB (NextAuth cookie)                    MOBILE (Bearer JWT)
RSC / Server Actions                     /api/v1/* JSON
        │                                        │
        └──────────────┬─────────────────────────┘
                       ▼
              lib/permissions + services
                       ▼
         Prisma 7 + pg adapter → PostgreSQL (Neon in prod)
                       ▼
              Redis (optional cache)
```

Request proxy (`proxy.ts`, Next.js 16 replacement for `middleware.ts`) does **optimistic redirects only**. Real auth is in page guards, route handlers, and services.

## 2. Next.js / Node / React

| Item | Value |
| --- | --- |
| Next.js | **16.3.3** (App Router only; no `pages/`) |
| React | **19.2.8** |
| Node requirement (Next engines) | **>= 20.9.0** |
| CI Node | **20** (`.github/workflows/deploy.yml`) |
| Local Node observed | 22.23.2 |
| `package.json` `engines` | **not set** |
| Router | App Router (`app/`) |
| Next 16 request proxy | `proxy.ts` |
| `output: "standalone"` | **not enabled** (compatible; recommended for Docker later) |
| Image optimization | Enabled; `remotePatterns` for googleusercontent, Facebook lookaside, Unsplash |
| Server Actions | 15 action files; `experimental.serverActions.allowedOrigins` is staging/local only |
| Auth interrupts | `experimental.authInterrupts: true` |
| External packages | `serverExternalPackages: ["ioredis"]` |
| Bind address | `next start` defaults to **0.0.0.0:3000** (`PORT` / `-H` override) |

Production start must remain `next build` then `next start` (or standalone `node server.js`). Do **not** use `next dev` in production.

## 3. Package manager

**Ambiguous. Must be decided before Docker/CI work.**

| Signal | Value |
| --- | --- |
| README | Instructs **pnpm** |
| `package-lock.json` | Present (npm lockfileVersion 3) |
| `pnpm-lock.yaml` | Present (lockfileVersion 9) |
| `pnpm-workspace.yaml` | Present (Prisma engine allowBuilds only; not a real workspace) |
| `packageManager` field | Absent |
| Current GitHub Actions | **`npm install`** (not `npm ci`, not pnpm) |

Canonical production installs should pick **one** manager and one lockfile. Today CI is npm.

Scripts:

| Script | Command |
| --- | --- |
| `dev` | `next dev` |
| `build` / `build:ci` | `next build` |
| `start` | `next start` |
| `lint` | `eslint` |
| `check-env` | `node scripts/check-env.js` |
| `db:generate` | `prisma generate` |
| `db:migrate` | `prisma migrate dev` (**dev-only**) |
| `db:seed` | `prisma db seed` |
| `postinstall` | `prisma generate` |
| `security:scan` | `bash .githooks/pre-commit --ci` |
| `test` | **missing** |

## 4. Database / Neon / ORM

| Item | Value |
| --- | --- |
| ORM | **Prisma 7.10.0** (`prisma-client` generator, output `generated/prisma`) |
| Driver | `@prisma/adapter-pg` (required in Prisma 7; no query-engine binary) |
| Provider | PostgreSQL |
| Connection | `DATABASE_URL` only (runtime in `lib/db/prisma.ts`, CLI in `prisma7.config.ts`) |
| Neon-specific SDK | **None** — Neon is a Postgres URL. Production should use Neon pooled URL + TLS (`sslmode=require`) |
| Postgres on EC2 | Must **not** be added; DB stays on Neon |
| Migrations | `prisma/migrations/` — two additive migrations (`init`, `admin_rbac_audit`). No DROP/RESET found |
| Production migrate script | **None**. Only `prisma migrate dev`. Need `prisma migrate deploy` later, run deliberately in CI/CD, not on every container start |
| Seed | `prisma/seed.ts` via `tsx`; uses `ADMIN_EMAIL` / `ADMIN_PASSWORD` |
| Generated client | `/generated` is gitignored; regenerated by `postinstall` / `prisma generate` |

Do not run destructive migrate/reset in production. Rolling deploys require additive, backward-compatible migrations.

## 5. Authentication

| Surface | Mechanism |
| --- | --- |
| Web | NextAuth v4 (`next-auth@^4.24.15`) + `@next-auth/prisma-adapter` |
| Session | **JWT strategy** (stateless cookies) — **sticky sessions not required** |
| Mobile | jose HS256 access + refresh tokens (`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`) |
| Credentials | Email/password, phone OTP |
| OAuth (env-gated) | Google, Facebook, Apple — only registered when both ID + secret are set |
| Demo social | `ALLOW_DEMO_SOCIAL=true` (or non-production) — must stay off in production |
| Dev auth fallback | `getAuthContext` auto-impersonates an ADMIN when `NODE_ENV !== "production"` — production-safe as written |
| Web handler | `app/api/auth/[...nextauth]/route.ts` |
| Mobile API | `/api/v1/auth/{register,login,refresh,logout,otp,forgot-password,reset-password,verify-email,session,invitations/*}` |

Apple env mismatch:

- Runtime + `check-env` expect `APPLE_CLIENT_SECRET`
- `.env.example` documents `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (not used by `lib/auth/options.ts`)

## 6. API / SSR / Server Actions

| Area | Status |
| --- | --- |
| Pages Router | Not used |
| SSR | Yes — protected layouts call `requirePageUser()`; many `app/(protected)/**/page.tsx` |
| Route handlers | ~91 files under `app/api/` |
| Mobile API | `/api/v1/*` JSON envelope (`lib/api/handler.ts`, `lib/api/response.ts`) |
| Server Actions | `actions/auth`, `actions/user`, `actions/host`, `actions/admin` |
| Cron / workers | **None**. `POST /api/v1/admin/hosts/compliance/check-expirations` is an authenticated on-demand job, not a scheduler |
| Local file uploads | Listing photos, stamp icons, host documents written under `public/uploads/**` — **not shared across EC2 instances**; ephemeral in Docker |
| Maps | Leaflet loaded client-side; CSS from unpkg CDN |
| Fonts | `next/font/google` (Poppins, Geist Mono, Caveat) + Font Awesome from cdnjs |

`next.config.ts` `allowedDevOrigins` and `serverActions.allowedOrigins` currently list `localhost:3000` and `*.dynamicdreamz.net` only. Production hostname must be added later without breaking staging.

## 7. Environment variables

Required at runtime:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres / Neon |
| `NEXTAUTH_SECRET` | NextAuth JWT (≥16 chars) |
| `JWT_ACCESS_SECRET` | Mobile access tokens |
| `JWT_REFRESH_SECRET` | Mobile refresh tokens |

Important optional / defaulted:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development` / `production` / `test` |
| `APP_URL` | Links in email/invites (default `http://localhost:3000`) |
| `NEXTAUTH_URL` | NextAuth base URL |
| `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL` | Mobile JWT TTLs |
| `REDIS_URL` / `REDIS_ENABLED` / `REDIS_DEFAULT_TTL` / `REDIS_CONNECT_TIMEOUT` | Optional cache |
| `LOGIN_RATE_LIMIT_*` / `OTP_*` | Rate limit + OTP |
| `RESEND_API_KEY` / `EMAIL_FROM` | Email |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` | SMS OTP |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | Facebook OAuth |
| `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET` | Apple OAuth (runtime) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seed only |
| `ALLOW_DEMO_SOCIAL` | Dev/demo social login — do not set in production |

Not in `check-env` but relevant later:

| Variable | Purpose |
| --- | --- |
| `PORT` / `HOSTNAME` | Container listen address |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Required for multi-instance Server Actions (Next 16 self-hosting docs) |
| `NEXT_PUBLIC_*` | None found — secrets stay server-side |

`lib/env.ts` parses `envSchema` but **is never imported**. App startup does **not** run full env validation; only `DATABASE_URL` is hard-required at Prisma init. `npm run check-env` is a separate script.

`.env.example` exists locally with placeholders (no real secrets). It is **not in git** because `.gitignore` has `.env*`.

**Do not bake any of these into a Docker image.** Inject at runtime.

## 8. Third-party services

| Service | Status | Hard dependency? |
| --- | --- | --- |
| Neon / Postgres | Via `DATABASE_URL` | **Yes** |
| Resend | Email when `RESEND_API_KEY` set; otherwise console in dev, warn in prod | No (features degrade) |
| Twilio | SMS OTP when SID/token/from set | No |
| Google / Facebook / Apple OAuth | Env-gated | No |
| Redis (`ioredis`, optionalDependency) | Cache + optional distributed rate limit | **No** — app falls back to DB |
| Leaflet / unpkg CSS | Client maps | No |
| Font Awesome cdnjs | CSS CDN | No |
| nodemailer | Declared (NextAuth peer); email send path uses Resend | Indirect |

## 9. Redis

Optional performance layer. Configured only when `REDIS_URL` is `redis://` or `rediss://` and `REDIS_ENABLED !== "false"`.

- Missing package, missing URL, or connection failure → cache bypass, app continues
- Used for listing/user/admin cache keys and optional async rate limiting
- NextAuth login `assertLoginRateLimit` is **in-memory per process** (not Redis)
- Must not be a Docker Compose hard dependency unless ops choose to enable it

## 10. Health check

Existing: `GET /api/v1/health`

- Hits Postgres (`SELECT 1`) and Redis PING
- 200 if DB healthy, 503 if DB down
- Redis down does **not** fail the check

This is a **readiness-style** probe. Load-balancer liveness should not pay a DB round-trip every few seconds. Later task: add a cheap `/api/health` (or keep this as `/ready`) per Phase 8.

## 11. Existing Docker configuration

**None.**

No `Dockerfile`, `.dockerignore`, or Compose files.

## 12. Existing CI/CD

Provider: **GitHub Actions** (`.github/workflows/deploy.yml`), trigger `push` to `main`.

| Job | Runner | What it does |
| --- | --- | --- |
| `validate` | `ubuntu-latest` | Checkout, Node 20, malware scan (uncommitted addition), `npm install`, `npm run build:ci` with dummy `DATABASE_URL` / auth secrets |
| `deploy` | **self-hosted** | Sync git to `/var/www/html/Homyz`, scan, `npm install`, `npm run build`, **PM2 restart** |

Gaps vs target AWS/Docker pipeline:

- No lint, typecheck, or tests in CI
- No Docker build / ECR push
- Builds **on the VPS**, not from an immutable image
- Rollback is git SHA restore after failed **scan** only — not after a failed health check
- PM2 restart is not blue/green
- No OIDC/ECR/EC2 deploy secrets documented in-repo
- `npm install` (mutable) rather than a frozen lockfile install

Tests exist under `__tests__/` as custom `node:assert` scripts (need DB/dotenv). There is no `npm test` script and no Jest/Vitest.

## 13. Logging / monitoring / shutdown

- Logging is `console.log` / `console.warn` / `console.error` with `[api]`, `[action]`, `[redis]`, `[email]`, `[sms]` prefixes
- Production SMS/email paths avoid printing OTP codes
- `check-env.ts` can print a Redis URL if one is set — do not run that script against production logs carelessly
- No `instrumentation.ts`, OpenTelemetry, or CloudWatch agent in-app
- Next.js 16 App Router `next start` finishes in-flight work and `after()` on SIGTERM/SIGINT (self-hosting docs). Docker stop grace period still needed later
- Prisma client is **not** stored on `globalThis` in production (`lib/db/prisma.ts`) — extra connections possible under multi-worker; review in performance phase

## 14. Images / static assets

- `next/image` used on auth, header, profile, and related components
- Remote patterns: `*.googleusercontent.com`, `platform-lookaside.fbsbx.com`, `images.unsplash.com`
- Static files in `public/`
- User uploads written to `public/uploads/` — lost on container replace; not visible to other EC2s

## 15. Stateless / load balancer notes

Safe for ALB without stickiness:

- NextAuth JWT sessions
- Mobile JWTs
- No in-process session store

Not fully stateless yet:

- Local disk uploads
- In-memory login rate limiter
- Per-instance Next.js cache (default)
- Server Action encryption key is per-build unless `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is set

---

## Known issues (deployment-relevant, not fixed in Task 1)

1. Dual lockfiles (npm + pnpm); README vs CI disagree.
2. No Docker / Compose / ECR / ALB / HTTPS docs.
3. `.env.example` gitignored by `.env*`.
4. No production `prisma migrate deploy` path; `db:migrate` is `migrate dev`.
5. Health check always queries the database.
6. Local filesystem uploads break multi-instance and immutable containers.
7. `serverActions.allowedOrigins` / `allowedDevOrigins` lack a production host placeholder.
8. Apple env documented vs actually consumed mismatch.
9. `lib/env.ts` unused — runtime env not fully validated at boot.
10. CI has no lint / typecheck / unit tests; deploy builds on the server via PM2.
11. No `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` for multi-EC2.
12. Redis URL may be logged by `check-env.ts`.

---

## Remaining tasks (sequential — do not skip validation)

| # | Task | Status |
| --- | --- | --- |
| 1 | Production deployment audit | **Done** |
| 2 | Production Dockerfile (multi-stage, standalone if compatible, non-root) | Next |
| 3 | `.dockerignore` | Pending |
| 4 | Next.js production config (`output: "standalone"` if safe) | Pending |
| 5 | Runtime env/secrets (no secrets in image) | Pending |
| 6 | Neon connection + controlled Prisma migrate strategy | Pending |
| 7 | `docker-compose.prod.yml` (app only; Redis optional) | Pending |
| 8 | Lightweight health (+ optional ready) | Pending |
| 9–13 | ALB / HTTPS / EC2 / security groups / bind `0.0.0.0` docs | Pending |
| 14–18 | CI/CD, ECR, immutable tags, zero-downtime deploy, rollback | Pending |
| 19–25 | Migration safety, Redis optional, performance, images, logging, monitoring, SIGTERM | Pending |
| 26–33 | `.env.example` in git, `docs/deployment.md`, commands, secrets, IaC notes | Pending |
| 34 | Validation checklist | Pending |

**Next task after this report is accepted:** Task 2 — Production Dockerfile.

---

## Rules for the next agent

1. Read this file first.
2. Do one task, then validate, then update this file.
3. Do not put secrets in images or git.
4. Do not run Postgres in Docker/EC2.
5. Do not expose port 3000 publicly.
6. Do not break SSR, Server Actions, `/api/v1`, or NextAuth.
7. Redis stays optional.
8. Prefer immutable image tags and health-checked deploys.
9. Keep APIs mobile-compatible.
10. Use the existing GitHub Actions provider; evolve it rather than inventing a second CI system unless required.
