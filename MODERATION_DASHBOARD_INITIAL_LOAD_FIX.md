# Moderation Dashboard Initial Load Fix

## Root cause

`getModerationAnalytics` ran a database probe with an 800 ms `Promise.race`. A
slow cold connection was treated as an unavailable database and returned a
successful, all-zero analytics payload (`trends: []` and `100%` on-time SLA)
rather than an error. The page consequently rendered that payload as real data.
Once the connection was warm, a later date-filter request could return the
actual analytics data.

The overview's high-priority, unassigned, and recent-activity widgets were
also sourced from a separate server-only summary. They did not refresh when the
date filter refreshed analytics, so the dashboard could show a mix of ranges.

## Changes

- `services/moderation-analytics.service.ts`
  - Removed the arbitrary 800 ms probe race and zero-result fallback.
  - Database probe failures now return a retryable `503` error instead of fake
    analytics data; only successful probes are cached for one minute.
  - Added a single `operational` analytics section for the overview widgets,
    so all dashboard values arrive in one response.
  - Made date-only custom end dates inclusive through `23:59:59.999 UTC` and
    reject inverted custom ranges.
  - Returns `null` for the on-time SLA where no resolved eligible cases exist;
    CSV exports display this as `N/A`.
- `app/(protected)/admin/moderation/page.tsx`
  - Uses one canonical analytics request for the initial server render. This
    removes the overlapping summary request.
- `app/(protected)/admin/moderation/admin-moderation-dashboard-client.tsx`
  - Uses the same analytics response for all KPI and overview widgets.
  - Adds cancellation and sequence guards for rapid filter changes, a
    retryable error alert, URL history support, and back/forward refetching.
  - Preserves `targetType` and `status` query parameters during date changes.
  - Displays `N/A` rather than `100%` when the SLA denominator is zero.
  - Labels date-scoped open-case and urgent-backlog counts as in-range values,
    rather than implying an all-time queue total.
- `app/(protected)/admin/moderation/loading.tsx`
  - Aligned the server loading skeleton with the dashboard shell and six KPI
    cards.
- `components/admin/moderation-setup-pending.tsx`
  - Distinguishes a temporary analytics outage from a missing migration and
    provides a server-refresh Retry action for the former.
- `__tests__/moderation-dashboard-initial-load.test.ts`
  - Added focused regression coverage for the initial-load safeguards.

## Request and state behavior

On direct navigation or refresh, the Server Component requests the default
`30d` rolling UTC range through `getModerationAnalytics` and renders only a
successful database-backed payload. The route loading UI remains visible while
that request is pending. A database problem now shows the existing unavailable
state rather than zero metrics.

On a date change, the client requests the same service through the protected
analytics API. A newer request aborts the prior one and only the latest response
can update state; refresh requests use `no-store` without changing global
caching. Browser history navigation rehydrates the selected URL range.

## Verification

Passed:

- `node --import tsx --test __tests__/moderation-dashboard-initial-load.test.ts`
  - 6 tests passed.
- `npx tsc --noEmit`
- `npx prisma validate`
- Pure custom-date boundary runtime check with a non-connecting test database
  URL (`2026-10-01` through `2026-10-15` resolved to the expected inclusive
  UTC bounds).

Not run in this workspace:

- Database-backed and browser E2E checks. `DATABASE_URL` is not configured, so
  the existing database-importing moderation test suites cannot start. No
  database records were modified and no performance timing was invented.

`git diff --check` still reports an unrelated existing trailing blank line in
`components/profile/my-reports-view.tsx`; it was not changed by this work.
