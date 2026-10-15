# Phase 2 — Admin Moderation Dashboard and Case Management

## Implemented

- `/admin/moderation` provides database-backed KPI cards, date-range filtering, urgent/unassigned attention links, content-type distribution, open workload, and recent activity.
- `/admin/moderation/cases` provides server-paginated cases with status tabs, URL-persistent search/filter/sort controls, bounded page sizes, responsive table layout, and empty/loading/error states.
- `/admin/moderation/cases/[id]` provides a private operational view of the target, individual reports, evidence metadata, activity timeline, case controls, assignment, transitions, resolution/dismissal confirmation, and append-only internal notes.
- Adds protected summary, moderator lookup, case detail, and private-note endpoints while extending the existing Phase 1 case-list and update endpoints.

## Security and operational boundaries

- Every API route authenticates and enforces its specific moderation permission. UI visibility is only a convenience; authorization is repeated by route and service.
- The case page requires optimistic concurrency (`expectedUpdatedAt`) for changes. The service checks the persisted timestamp again in its transaction before applying the update and appending activity.
- Moderator candidates are active administrator/RBAC users only. Assignment, decision, evidence and case-update permissions are distinct.
- Target previews are selected per content type and do not expose listing secrets, private evidence storage references, or unrestricted conversation data.
- Resolution/dismissal requires a resolution category and is an investigation decision only. This phase makes no review, listing, account, booking, refund, payment, or payout mutation.

## Data and performance

The existing Phase 1 models are reused; no new tables were added. The un-applied, additive moderation migration now also includes indexes for status/last-activity and category/creation-date queue filters. Case lists project only queue data and counts, while reports, evidence, and activity load only on the detail page. Counts use `count`/`groupBy` queries rather than downloading cases.

The query filters are bound, whitelisted, and paginated (maximum 50 items). Text search is debounced in the client and cancels obsolete fetches. Sorts have deterministic ID tie breaks. There is no polling; mutations refresh only the affected detail or queue data.

## Validation

Passed:

- `npx prisma validate`
- `npx tsc --noEmit`
- Phase-specific ESLint checks
- `node --import tsx --test __tests__/moderation-foundation.test.ts` (6 passing subtests)

Database integration and live UI verification remain blocked by the pre-existing Prisma migration-history mismatch recorded in the Phase 1 audit. No migration was applied or database data changed. Reconcile that history, apply the additive moderation migration to a disposable database, then run authorization, concurrency, and full user-flow integration tests before production deployment.

Until that migration is present, the moderation service checks for its required tables before issuing case queries. Admin moderation pages render a clear setup-pending state and APIs return a controlled `503` response instead of crashing on Prisma `P2021` table-not-found errors.

## Phase 3 readiness

Phase 2 is ready for guest/host-facing report and review-management work after migration reconciliation. Remaining product decisions are evidence file proxy/retention, generalized multi-role account representation, and future enforcement policy. None were inferred or implemented here.
