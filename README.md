# homyz — Auth, Roles & Mobile-Ready API

A Next.js 16 application with a production-grade **authentication + authorization**
system whose business logic lives in a **shared service layer**, so the *same*
backend serves the web app (SSR / Server Actions) and future **mobile** clients
(REST/JSON) with no logic duplicated between them.

## Highlights

- **Roles:** `ADMIN`, `HOST`, `USER` (Postgres enum). ADMIN is **never**
  selectable at signup and **never** trusted from client input — it is granted
  only through the trusted admin path (`PATCH /api/v1/admin/users/[id]/role`) or
  the seed script.
- **Auth methods:** email/password, Google/Facebook/Apple OAuth (env-gated),
  phone/email OTP, forgot/reset password, email verification.
- **One backend, two surfaces:** web uses the NextAuth session cookie; mobile
  uses app-signed access + refresh tokens (`Authorization: Bearer`). Both
  normalize to `{ id, role, email }` and feed the same permission + service
  layers.
- **Defense in depth:** role + ownership are enforced in route-handler guards,
  in the service layer, **and** in SSR page guards. `proxy.ts` does optimistic
  redirects only — it is not the security boundary.
- **Consistent JSON envelope** with proper HTTP status codes; no stack traces or
  secrets ever leak to clients.

## Architecture

```
        WEB (cookie)                         MOBILE (Bearer)
  RSC / Server Actions                    REST JSON client
        │ getSessionUser()                       │ getAuthContext(req)
        └──────────────┬─────────────────────────┘
                       ▼
        lib/permissions  (authorize / assertRole / assertOwnership)
                       ▼
        services/*.service.ts     ← ALL business logic lives here
                       ▼
        lib/db (Prisma + pg adapter)  →  PostgreSQL
```

Route handlers, Server Actions, and SSR pages are thin:
**authenticate → validate (zod) → authorize → call a service → return.**

### Layout

```
prisma/           schema.prisma, seed.ts
lib/
  db/             Prisma client (pg driver adapter)
  auth/           NextAuth options, session/context resolvers, tokens, password
  permissions/    authorize, route guards, page guards
  api/            response envelope, errors, apiHandler, pagination
  validation/     shared zod schemas (web + mobile)
  services/       email / sms / rate-limit (dev stubs, env-gated real adapters)
services/         auth / user / listing / booking / admin  (business logic)
actions/          Server Actions (auth / user / host / admin) → call services
app/
  api/v1/         versioned mobile JSON API
  api/auth/       NextAuth web handler
  (auth)/         login, register, verify, forgot/reset password
  (protected)/    dashboard, profile, bookings, host, admin
proxy.ts          optimistic redirects (NOT the boundary)
docs/API.md       full endpoint reference
scripts/smoke.sh  end-to-end API smoke test
```

## Prerequisites

- Node.js 22+ and **npm** (CI and Docker use `package-lock.json`)
- **PostgreSQL** running locally (or a reachable `DATABASE_URL`)

## Setup

```bash
pnpm install

# 1. Configure environment
cp .env.example .env
#   - set DATABASE_URL to your Postgres instance
#   - set NEXTAUTH_SECRET / JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (e.g. `openssl rand -base64 32`)
#   - (optional) OAuth, Resend, Twilio keys — features activate only when set
#   - ADMIN_EMAIL / ADMIN_PASSWORD seed the initial admin

# 2. Create the schema and seed the first ADMIN
pnpm prisma migrate dev
pnpm prisma db seed

# 3. Run
pnpm dev
```

Open http://localhost:3000. The starter page remains at `/`; auth lives at
`/login` and `/register`.

> OAuth providers only appear when their env vars are set, so the app runs fully
> on email/password locally. In dev, OTP codes and reset/verification links are
> logged to the server console (never sent, never logged in production).

## Testing the API

With the dev server running:

```bash
./scripts/smoke.sh
```

This walks the mobile token lifecycle (register → login → `/users/me` with
Bearer → refresh → logout) and asserts the security invariants: public signup
**rejects** `role:"ADMIN"` (422), protected endpoints reject no-token requests
(401), and a rotated refresh token can't be reused.

See **[docs/API.md](docs/API.md)** for the full endpoint reference (methods,
auth, roles, request bodies, responses).

## Verification

```bash
pnpm exec tsc --noEmit   # types
pnpm build               # production build
pnpm lint                # eslint
```

## Security notes

- Passwords hashed with bcrypt; OTP codes hashed and rate-limited with expiry +
  attempt caps; reset tokens are single-use with expiry.
- Web sessions use httpOnly JWT cookies; CSRF handled by NextAuth + Server
  Actions origin checks; OAuth `state` handled by NextAuth.
- Services return DTOs only — `passwordHash` and other secrets never leave the
  service layer.
- Direct database access is never exposed to the browser, mobile app, or client
  components.
