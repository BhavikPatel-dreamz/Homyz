# homyz API Reference (v1)

A single, stateless, versioned JSON API under `/api/v1/` serves **both** the web
app (Server Components / Server Actions, via the NextAuth session cookie) and
future **mobile** clients (via a Bearer access token). All business logic lives
in the service layer (`services/*.service.ts`); route handlers only
**authenticate → validate → authorize → call a service → return**.

## Base URL

```
http://localhost:3000/api/v1
```

## Authentication

Two credential types resolve to the same normalized identity (`{ id, role, email }`)
and feed the same permission + service layers:

| Surface | Credential | How it's sent |
| --- | --- | --- |
| Web (RSC / Server Actions) | NextAuth session (JWT) | httpOnly cookie, set on sign-in |
| Mobile / API clients | App-signed access token | `Authorization: Bearer <accessToken>` |

For protected route handlers the Bearer token is checked first; if absent, the
NextAuth cookie is used. Obtain mobile tokens from `POST /auth/login` and rotate
them with `POST /auth/refresh`.

> **Never** put tokens in `localStorage`. Web uses httpOnly cookies; mobile
> should use the platform secure store (Keychain / Keystore).

## Response envelope

Every response uses one consistent shape.

**Success**
```json
{ "success": true, "data": { /* ... */ } }
```

**Success (paginated list)**
```json
{
  "success": true,
  "data": [ /* items */ ],
  "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

**Error** — no stack traces or internal details are ever leaked.
```json
{ "success": false, "error": { "code": "VALIDATION", "message": "Validation failed", "details": [ { "path": "email", "message": "Invalid email address" } ] } }
```

### Status codes & error codes

| HTTP | `error.code` | When |
| --- | --- | --- |
| 200 | — | OK |
| 201 | — | Resource created |
| 400 | `BAD_REQUEST` | Malformed / invalid request (e.g. bad token) |
| 401 | `UNAUTHORIZED` | Missing or invalid credentials |
| 403 | `FORBIDDEN` | Authenticated but wrong role, or not the owner |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Duplicate (e.g. email/phone already in use) |
| 422 | `VALIDATION` | Zod schema validation failed (`details[]` included) |
| 429 | `RATE_LIMITED` | Login / OTP throttling |
| 500 | `INTERNAL` | Unexpected server error (generic message only) |

### Pagination query params

List endpoints accept `?page=` (default `1`, min `1`) and `?limit=` (default
`20`, clamped to `100`).

---

## Auth endpoints (`/api/v1/auth`)

All are public (no auth required) unless noted.

### `POST /auth/register`
Create a **USER or HOST** account. `role` is whitelisted to `USER | HOST`;
**ADMIN is never accepted here** (assigned only by the trusted admin path).

Request:
```json
{ "name": "Ada", "email": "ada@example.com", "password": "hunter2pw", "role": "USER" }
```
`201` → `data`: public user `{ id, name, email, role, phone, image, emailVerified, phoneVerified, createdAt }`.
Errors: `409` email exists, `422` validation.

### `POST /auth/login`
Email/password → mobile token pair.

Request: `{ "email": "ada@example.com", "password": "hunter2pw" }`
`200` →
```json
{ "success": true, "data": { "user": { /* public user */ }, "accessToken": "…", "refreshToken": "…", "expiresIn": 900 } }
```
Errors: `401` invalid credentials, `429` too many attempts.

### `POST /auth/refresh`
Rotate a refresh token (old token is revoked and replaced).

Request: `{ "refreshToken": "…" }`
`200` → `{ "accessToken": "…", "refreshToken": "…", "expiresIn": 900 }`
Errors: `401` invalid/expired/revoked token.

### `POST /auth/logout`
Revoke the supplied refresh token.

Request: `{ "refreshToken": "…" }` → `200` `{ "success": true }`.

### `GET /auth/session` 🔒
Current caller's profile (cookie or Bearer). `200` → public user. `401` if unauthenticated.

### `POST /auth/otp/send`
Issue a one-time code. Rate-limited by a resend cooldown.

Request: `{ "identifier": "+15551234567", "channel": "SMS", "purpose": "PHONE_VERIFICATION" }`
(`channel`: `SMS | EMAIL`; `purpose`: `PHONE_VERIFICATION | LOGIN | PASSWORD_RESET`)
`200` → `{ "success": true }`. Errors: `429` cooldown.

### `POST /auth/otp/verify`
Validate a one-time code (expiry + attempt cap enforced).

Request: `{ "identifier": "+15551234567", "code": "123456", "purpose": "PHONE_VERIFICATION" }`
`200` → `{ "success": true, "verified": true }`. Errors: `400` invalid/expired, `429` too many attempts.

### `POST /auth/forgot-password`
Email a reset link **if** the account exists. Always `200` `{ "success": true }`
(no account enumeration).

Request: `{ "email": "ada@example.com" }`

### `POST /auth/reset-password`
Consume a reset token and set a new password (also revokes mobile sessions).

Request: `{ "token": "…", "password": "newpassword" }`
`200` → `{ "success": true }`. Errors: `400` invalid/expired token.

### `POST /auth/verify-email`
Consume an email-verification token.

Request: `{ "token": "…" }` → `200` `{ "success": true }`. Errors: `400` invalid/expired.

### `GET|POST /api/auth/[...nextauth]`
NextAuth web handler (sign-in/out, OAuth callbacks, CSRF). Used by the browser
session; not part of the mobile JSON API.

---

## Users (`/api/v1/users`)

### `GET /users/me` 🔒
Caller's own profile. `200` → public user.

### `PATCH /users/me` 🔒
Update own profile. At least one field required.

Request: `{ "name": "Ada L.", "phone": "+15551234567", "image": "https://…" }`
`200` → public user. Changing `phone` clears `phoneVerified`. Errors: `409` phone in use, `422`.

### `GET /users/[id]` 🔒 **ADMIN**
Fetch any user by id. `200` → public user. `403` for non-admins, `404` if missing.

---

## Listings (`/api/v1/listings`)

### `GET /listings`
Public catalogue of **published** listings (paginated). `200` → list of listing DTOs
`{ id, hostId, title, description, price, published, createdAt, updatedAt }`.

### `POST /listings` 🔒 **HOST | ADMIN**
Create a listing owned by the caller. `price` is an integer in minor units (cents).

Request: `{ "title": "Cabin", "description": "Cozy", "price": 12000, "published": true }`
`201` → listing DTO. Errors: `401`, `403`, `422`.

### `GET /listings/[id]`
Public read of one listing. `200` → listing DTO. `404` if missing.

### `PATCH /listings/[id]` 🔒 **owner HOST | ADMIN**
Update. **Ownership enforced in the service** — a host editing another host's
listing gets `403`; ADMIN overrides. At least one field required.
`200` → listing DTO.

### `DELETE /listings/[id]` 🔒 **owner HOST | ADMIN**
`200` → `{ "success": true }`. `403` for non-owners, `404` if missing.

### `GET /hosts/listings` 🔒 **HOST | ADMIN**
The calling host's **own** listings only (paginated). `200` → list of listing DTOs.

---

## Bookings (`/api/v1/bookings`)

### `GET /bookings` 🔒
The caller's own bookings (paginated). `200` → list of booking DTOs
`{ id, userId, listingId, status, startDate, endDate, createdAt }`.

### `POST /bookings` 🔒
Create a booking for the caller. The listing must exist and be published.

Request: `{ "listingId": "…", "startDate": "2026-09-01", "endDate": "2026-09-05" }`
`201` → booking DTO. Errors: `404` listing not found, `422` (e.g. `endDate` not after `startDate`).

---

## Admin (`/api/v1/admin`) — 🔒 **ADMIN only**

### `GET /admin/users`
List users (paginated), optional `?role=USER|HOST|ADMIN` filter. `200` → list of public users.

### `PATCH /admin/users/[id]/role`
Set a user's role. **This is the only path allowed to grant `ADMIN`.** Refuses to
demote the last remaining admin (`409`).

Request: `{ "role": "HOST" }` (`USER | HOST | ADMIN`)
`200` → public user. Errors: `403` non-admin, `404` missing, `409` last-admin, `422`.

---

## Authorization model (summary)

- **Roles:** `ADMIN`, `HOST`, `USER` (Postgres enum). ADMIN is never selectable at
  signup and never trusted from client input — it is assigned only via
  `PATCH /admin/users/[id]/role` (ADMIN-guarded) or the seed script.
- **Enforced server-side in three places** (defense in depth): route-handler
  guards (`requireApiAuth` / `requireApiRole`), the service layer
  (`authorize` / `assertOwnership`), and SSR page guards
  (`requirePageUser` / `requirePageRole`). `proxy.ts` only does optimistic
  redirects and is **not** the security boundary.
- **Ownership:** hosts can only read/mutate resources they own; ADMIN bypasses
  ownership. Enforced inside the services, not the routes.

---

## Health

### `GET /api/v1/health`
Public liveness/readiness probe. `200` when the database is reachable, `503`
when it is not. Redis is optional and never affects the status code.

```json
{ "success": true, "data": { "status": "ok", "database": "healthy", "redis": "disabled" } }
```

- `database`: `healthy | unavailable` (`SELECT 1`).
- `redis`: `disabled` (not configured / package absent) · `healthy` (PING ok) ·
  `unavailable` (configured but PING failed). Only status strings are exposed —
  never the connection string or any error internals.

---

## Redis (optional cache)

Redis is a **pure, optional performance layer**. The API contract is identical
whether Redis is enabled or not — mobile and web clients cannot tell the
difference. If `REDIS_URL` is blank, the `ioredis` package is missing, or Redis
errors/times out, every read transparently falls back to the database. **No
request ever fails because of Redis**, and Redis is never a source of truth.

### Configuration (env)

| Var | Default | Meaning |
|---|---|---|
| `REDIS_URL` | `""` | Connection string. **Blank ⇒ cache disabled** (DB-only). |
| `REDIS_ENABLED` | `true` | Set `false` to disable even when a URL is present. |
| `REDIS_DEFAULT_TTL` | `300` | Fallback TTL (seconds) when a call passes none. |
| `REDIS_CONNECT_TIMEOUT` | `2000` | Connect timeout (ms); also the per-op timeout ceiling. |

### What is cached

Caching lives in the **service layer**, so it covers API routes, Server Actions,
and RSC from one place. Authentication/authorization run at the route/page
boundary *before* the cached read, so cache hits sit behind the existing guards.

| Read | Key | TTL |
|---|---|---|
| `GET /listings/[id]` | `homyz:listing:{id}` | 300s |
| `GET /listings` (published view, shallow pages `skip ≤ 200`) | `homyz:listings:published:v{ver}:s{skip}:t{take}` | 120s |
| `GET /users/me`, `GET /users/[id]`, profile page | `homyz:user:{id}:profile` | 180s |
| `GET /admin/stats` counts | `homyz:stats:global` | 60s (TTL-only) |

**Never cached:** passwords, OTPs, verification/reset/refresh/access tokens, and
any auth secret; bookings (private + availability-sensitive); a host's own
listing list and the admin user list (low-traffic / high-churn). Private data is
keyed by its owner's id, so a cache entry can never leak between users.

### Invalidation

Writes invalidate **after** the DB transaction commits (the TTL is a backstop):

- Update/delete a listing → drop `listing:{id}` **and** bump the catalogue
  version (`INCR homyz:listings:published:ver`, an O(1) invalidation of every
  page). Create a *published* listing → bump the version.
- `PATCH /users/me` (profile), `PATCH /admin/users/[id]/role`, email
  verification, and phone OTP verification → drop that user's `user:{id}:profile`.
  A role change also drops the cached profile immediately; effective
  authorization is unaffected because it derives from JWT claims, not the cache.
- Global stats are TTL-only (no explicit invalidation).
