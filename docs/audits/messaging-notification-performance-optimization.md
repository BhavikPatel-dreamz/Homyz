# Messaging & notification performance optimization

Status: IMPROVED_NOT_BENCHMARKED

## Scope and evidence

The audit covered the guest and host message workspaces, their conversation and
message APIs, notification-count store, notification API/service, and the
Prisma schema. No schema migration was justified: the existing indexes cover
conversation participant ordering, message conversation/date access, and
notification recipient/read/date access.

Confirmed bottlenecks before this change:

- `GET /api/v1/messages/conversations/:id/messages` returned every message in
  a conversation when called without `skip`/`take`. Both workspaces made that
  request on selection and again every 4.5 seconds while visible.
- The conversation list defaulted to 50 rows and joined profile, listing,
  reservation, attachment, and up to ten special-offer records per row even
  though a row displays only identity, property title, status, and preview.
- The first message page also paid for a `count()` even though the workspace
  only needs to know whether another page exists.
- The global notification-count store could retain an old account's in-flight
  result through logout/account switching.

## Changes

| Area | Status | Improvement |
| --- | --- | --- |
| Conversation list | OPTIMIZED_VERIFIED | Initial page is 25 rows; API caps page size at 50, selects row-only fields, de-duplicates booking-context pairs, and exposes existing offset pagination through “Load more.” Full detail is fetched only for the selected conversation. |
| Message history | OPTIMIZED_VERIFIED | New reads fetch 40 newest messages with a stable `createdAt` + `id` cursor. Older pages prepend without duplicates and retain scroll position. Explicit legacy `skip` callers retain their ascending offset response. |
| Polling | OPTIMIZED_VERIFIED | Visibility-aware polling remains the existing transport, but refreshes only the active thread's newest 40 messages. Request tokens ignore stale thread responses. |
| Unread rules | ALREADY_OPTIMAL | Participant unread queries retain `senderId != actor.id`; nullable system/booking events are not counted. Reads avoid a write when the selected row is already read. |
| Notifications | OPTIMIZED_VERIFIED | The pre-existing count-only endpoint remains independent from list history. User-scoped in-flight count requests are now invalidated safely on logout/account changes. |
| Notifications list | ALREADY_OPTIMAL | It already has server-side `take` clamping, indexed recipient filters, recipient-scoped cache keys, independent unread count, and incremental “Load more.” |

## Files changed

- `services/messaging.service.ts`
- `app/api/v1/messages/conversations/[id]/messages/route.ts`
- `app/(protected)/messages/page.tsx`
- `app/(protected)/host/messages/page.tsx`
- `components/messages/guest-messages-workspace.tsx`
- `components/host/messages/host-messages-workspace.tsx`
- `lib/notifications/unread-count-store.ts`
- `components/dashboard/app-header.tsx`
- `components/admin/admin-header.tsx`

## Measurement record

No production-like benchmark fixture or browser profiler is available in this
workspace, so latency, memory, and database timings are intentionally not
invented. The before/after request bounds are source-verifiable:

| Metric | Before | After |
| --- | --- | --- |
| Initial conversation page | up to 50 full DTOs | 25 summary DTOs |
| Initial message history | unbounded | newest 40 |
| Active-thread poll | unbounded full history | newest 40 only |
| Older history | offset-only, not used by workspaces | cursor page on demand |
| History total count | every workspace history read | omitted for workspace reads |
| Notification count | independent count endpoint | unchanged, account-safe in-flight state |

## Verification

- `npx tsc --noEmit --pretty false` — passes.
- Messaging lifecycle and notification isolation tests exercised live database
  flows successfully, including authorization, read tracking, message delivery,
  and notification targeting.
- `npm run build` — completed successfully; the production build emitted
  `.next/BUILD_ID`.
- `__tests__/messaging-performance-optimization.test.ts` protects the new page
  bounds, cursor behavior, stale-response guard, unread semantics, and count
  reset behavior.
- Focused ESLint was run. It still reports pre-existing `no-explicit-any` and
  image warnings in large messaging/header files; no broad lint cleanup was
  included because it is outside this performance change.

## Remaining limitations

- Browser-level latency/memory profiling is BLOCKED by the lack of a
  production-like seeded deployment in this environment.
- Conversation-list pagination uses the existing offset-compatible API. Message
  history uses cursor pagination where the unbounded query existed.
- Existing polling remains intentionally in place; no WebSocket/SSE transport
  was added without evidence that the current transport is insufficient.
