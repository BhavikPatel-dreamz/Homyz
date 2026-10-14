# Dispute Notifications and Routes Fix

Audit date: 2026-10-14  
Scope: Host Resolution Center, shared user notifications, and admin dispute notifications.

## Root causes

1. **Known Host URL** — the App Router dynamic route now exists at
   `app/(protected)/host/resolution-center/[id]/page.tsx`, and it passes the
   URL `id` to the host-scoped dispute query. The supplied ID
   `cmv6moxdt0000ucas6tiliuu6` was not present in the connected development
   database, so its 404 is correct. An existing authorized case uses the same
   route; an unrelated host remains excluded by the `listing.hostId` predicate.
   The page now maps only a proved not-found result to `notFound()`; database
   and unexpected service failures are no longer masked as a false 404.
2. **Host-created cases did not notify admins** — creation notified the other
   booking party, but the admin fan-out only ran for Guest-created cases.
3. **Some case changes had no recipient notification** — assignment and
   closure persisted successfully but did not create notification records.
4. **View actions were not centrally resolved** — URLs were assembled at each
   event call site, and historical repair only handled Host notifications.
5. **Admin notifications were not reachable from the admin header** — the bell
   was a non-functional button. The shared in-app inbox is now linked from it.

## Implementation

- Added `lib/notifications/dispute-destination.ts`, the canonical resolver:
  Host → `/host/resolution-center/[disputeId]`; Admin →
  `/admin/bookings/disputes/[disputeId]`; Guest → the existing authorized
  `/bookings/[bookingId]` route. It returns no destination when a Guest
  booking reference is unavailable.
- Dispute creation now notifies admins for both Guest and Host reporters.
- Assignment notifies a newly assigned administrator, but never the assigning
  administrator.
- Closure notifies the Host and Guest after the close mutation has succeeded.
- Dispute notification payloads now consistently retain `disputeId`,
  `bookingId`, recipient role, and an event-specific `entityType`. Existing
  idempotency remains keyed by recipient, entity, type, and event type.
- Historical dispute notifications are safely repaired for Host, Guest, and
  Admin recipients only after their case relationship is proved. Deleted or
  unauthorized targets are untouched.
- Notification caches are invalidated by the shared creation service. The
  header refreshes its unread count on mount and foreground return; no polling
  or additional realtime transport was introduced.

## Files changed for this fix

- `services/dispute.service.ts` — event recipients, idempotent creation and
  closure/assignment notifications, canonical destinations.
- `services/notification.service.ts` — safe role-aware historical-link repair.
- `lib/notifications/dispute-destination.ts` — centralized route resolver.
- `app/(protected)/host/resolution-center/[id]/page.tsx` — preserve true
  not-found behavior without hiding other route failures.
- `components/admin/admin-header.tsx` — working admin inbox bell and unread
  badge.
- `components/dashboard/app-header.tsx` — bounded unread-count refresh.

The existing Host detail page/API and resolution-center UI are the route
implementation validated by this audit; they retain host ownership checks and
allow resolved and closed cases.

## Notification coverage

| Event | Guest | Host | Admin |
|---|---|---|---|
| Case created by Guest | Verified | Verified | Verified |
| Case created by Host | Verified | N/A (sender) | Verified |
| Host admin-only reply/response | N/A | N/A (sender) | Verified |
| Admin requests information | Verified when targeted | Verified when targeted | N/A (sender) |
| Assigned to admin | N/A | N/A | Verified for another assignee |
| Final resolution | Verified | Verified | N/A (sender) |
| Case closed | Verified | Verified | N/A (sender) |
| Admin internal note | N/A | N/A | N/A — intentionally private |
| Host private note | N/A | N/A — intentionally private | N/A — intentionally private |
| Admin shared reply / proposal acceptance | Blocked — no existing mutation or Guest case-detail conversation UI exists in this codebase |

## Route verification

| Role | Notification type | Destination | Result |
|---|---|---|---|
| Guest | Case/closure update | `/bookings/[bookingId]` | Pass: persisted-event test |
| Host | Case/closure update | `/host/resolution-center/[disputeId]` | Pass: persisted-event test; host-scoped service check |
| Admin | New case/assigned/reply update | `/admin/bookings/disputes/[disputeId]` | Pass: persisted-event test |
| Any role | Missing or unauthorized case | No accessible data | Pass: query is role scoped; supplied ID is absent and returns 404 |

## Verification evidence

- `pnpm exec tsc --noEmit` — pass.
- Targeted ESLint is **blocked** by pre-existing `no-explicit-any` errors in
  the already-modified dispute service (and unrelated existing warnings). The
  new resolver, route-page error handling, and notification-link repair add no
  ESLint errors.
- `scripts/verify-host-dispute-workflow.ts` — completed against the connected
  development database and removed its temporary case (verified zero temporary
  records afterward). It covers Host access, host response, private-note
  isolation, evidence access, admin notification links, resolution, and an
  unrelated-host denial when a second host is available.
- A targeted persisted-event check passed for a Host-created temporary case:
  admin creation notification, Guest booking destination, and both closure
  destinations matched the canonical resolver. The temporary case and its
  notifications were removed.
- The requested literal ID lookup returned `exists: false` in the connected
  development database; no claim is made that its browser navigation can pass
  without restoring or creating that record.

## Remaining functional boundaries

No WebSocket/SSE transport or durable outbox is implemented in this project.
The current in-app notification service is durable in the database and cache
invalidation/foreground refresh keeps reconnects and later views current.
Admin shared replies, Guest replies, proposal accept/decline, and escalation
do not have existing service mutations or an authorized Guest dispute-details
screen, so they were not invented during this focused route/notification fix.
