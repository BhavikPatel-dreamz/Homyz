# Admin Moderation: Fix and Production Readiness

## Result

The supplied authorized case (`cmv915yku0009dgas4rngwchd`, reference `MOD-VWDKF6EKUF`) now resolves through the same server-side service used by the page and API. It returns its listing target successfully instead of rendering a false 404.

## Exact 404 root cause

The record and dynamic route were valid. `getModerationCaseDetails` loaded the case and then failed while building the listing target summary:

- The query used `CHECKED_IN`, which is not a value in the current `BookingStatus` enum (`PENDING`, `CONFIRMED`, `CANCELLED`).
- The query also selected the obsolete `Booking.guest` relation; the current schema exposes `Booking.user`.
- The case-details page converted every non-503 exception, including these Prisma validation exceptions, into `notFound()`. A valid case therefore appeared as a 404.

The review target summary had the same kind of stale field problem (`ReviewResponse.content` / `user` instead of `comment` / `author`), which is corrected as part of the preventative fix.

## Changes

| Module | Initial issue | Fix implemented | Final status |
|---|---|---|---|
| Case Details 404 | Valid listing case became a 404 after a Prisma validation error | Use current booking enum/relations and reserve 404 for actual missing or hidden cases | Fixed and runtime verified |
| Case Details UI | Listing reservation card read the obsolete `guest` relation; review response UI read obsolete fields | Render `booking.user` and `response.author` / `response.comment` | Fixed |
| Central Cases Queue | Deep links needed confirmation after reported 404 | Confirmed links use canonical case IDs, not display references | Verified by regression test |
| Dashboard Analytics | No defect found in this focused pass | Reused existing analytics implementation; no synthetic values added | Existing suite passes |
| Reported Listings | Listing target hydration was broken by stale Prisma fields | Corrected target query without changing report/case workflow | Fixed and runtime verified |
| Review Moderation | Review response target summary used stale Prisma fields | Updated schema-aligned selection and UI rendering | Fixed; source regression covered |
| Media Moderation | No defect found in this focused pass | Reused existing canonical case workflow | Existing suite passes |
| User/Message Reports | No defect found in this focused pass | Reused existing protected reporting paths | Existing suite passes |
| Evidence Management | No defect found in this focused pass | No duplicate evidence service introduced | Existing suite passes |
| Moderator Assignment | No defect found in this focused pass | Existing permission and assignment workflow retained | Existing suite passes |
| Admin Decisions | No defect found in this focused pass | Existing centralized decision workflow retained | Existing suite passes |
| Enforcement | No defect found in this focused pass | Existing authorization split between decision and enforcement retained | Existing suite passes |
| Appeals | No defect found in this focused pass | Existing canonical appeals routes retained | Existing suite passes |
| Case Activity Timeline | No defect found in this focused pass | Existing case activity flow retained | Existing suite passes |
| Notifications & Links | False 404 prevented valid navigation | Correct error classification and canonical ID link coverage | Fixed |
| Search & Filters | No defect found in this focused pass | Existing server-side queue filters retained | Not changed |
| Pagination | No defect found in this focused pass | Existing queue pagination retained | Not changed |
| UI/UX | A valid target could not render; stale response fields would render empty | Corrected target data contracts without unrelated redesign | Fixed |
| Performance | Filter changes started both a page navigation and a separate analytics API request | Keep the shareable URL with Next.js native History API and issue only the API analytics refresh | Fixed; standalone 7-day analytics read measured 3.745s after schema repair (not a like-for-like browser benchmark) |
| Security & RBAC | Broad catch could disguise faults as 404 | Permissions remain enforced before retrieval; 403/404 remain privacy-preserving while unexpected failures propagate | Verified by source and workflow tests |
| End-to-End Testing | No regression coverage for this failure class | Added case-details 404 regression test and ran focused suites | Passed; browser E2E not run |

## Modified files

- `services/moderation.service.ts`
  - uses `BookingStatus.PENDING` / `BookingStatus.CONFIRMED`;
  - uses `Booking.user` / `userId` consistently in moderation target and participant/impact reads;
  - uses current `ReviewResponse.comment` / `author` fields.
- `app/(protected)/admin/moderation/cases/[id]/page.tsx`
  - maps only legitimate 404s, or deliberate privacy-preserving 403s, to `notFound()`;
  - lets unexpected errors reach normal error handling rather than hiding them as a missing page.
- `app/(protected)/admin/moderation/cases/[id]/admin-moderation-case-details-client.tsx`
  - renders the corrected booking and review-response relations.
- `__tests__/admin-moderation-case-details-404.test.ts`
  - guards enum/relation alignment, error classification, review response rendering, and canonical deep links.
- `prisma/migrations/20261015130000_add_background_job_queue/migration.sql`
  - creates the previously schema-only persistent background-job enums, table, and indexes.

## Validation performed

| Check | Result |
|---|---|
| Read-only real-data lookup of supplied case through `getModerationCaseDetails` | Passed: case ID, reference, `LISTING` target, and target availability matched |
| Read-only `getCaseParticipants` lookup for supplied case | Passed: 2 participants returned |
| Bounded sweep of existing moderation case target types | Passed for the available `LISTING` type; the database currently has one case in the sampled set |
| New case-details regression test | Passed: 5 tests, 0 failures |
| Focused moderation suites (foundation, reporting, safety, workflow, evidence, appeals, enforcement, media) | 45 assertions passed; database-dependent files require the configured environment noted below |
| Phase 4, 9, and 11 suites with configured test database environment | Passed: 29 tests, 0 failures |
| TypeScript (`pnpm exec tsc --noEmit`) | Passed |
| Prisma validation | Passed |
| Prisma migration status | Passed: 50 migrations; database schema up to date |

## Known limits / blockers

- Browser E2E was not run in this environment. The real database service path was exercised read-only instead.
- Running all focused test files without `dotenv/config` causes the database-dependent Phase 4, 9, and 11 files to stop before testing because `DATABASE_URL` is intentionally absent from the default shell. Those same files passed when rerun with the configured environment.
- No existing review, media, message, or user-target moderation case was available for a runtime case-details sample. Their corrected Prisma contracts are covered by static regression and existing focused suites.
- Targeted ESLint reports existing errors in the large moderation service and case-details client, including files/regions predating this focused fix. They are not suppressed or changed here; TypeScript compilation succeeds.
- No performance claim is made because no before/after performance benchmark was available.
