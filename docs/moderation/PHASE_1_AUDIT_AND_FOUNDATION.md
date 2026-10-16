# Phase 1 — Moderation Audit and Foundation

Status: implementation complete; deployment verification is blocked until the local migration history is reconciled (see [Migration safety](#migration-safety)). This document records verified findings from the repository as inspected on 2026-10-14.

## Existing-system audit

| Feature / module | Verified implementation and paths | APIs / models | Current issue, reuse, and action | Risk |
| --- | --- | --- | --- | --- |
| Property reviews | Eligible completed booking is checked in [`services/review.service.ts`](../../services/review.service.ts); public reviews are limited to `PUBLISHED`, and review aggregates/cache refreshes are handled by the same service. | `Review`, `Booking`; [`app/api/v1/listings/[id]/reviews/route.ts`](../../app/api/v1/listings/[id]/reviews/route.ts), `/host`, `/stats` | A review is already booking-bound and `bookingId` is unique, preventing duplicate booking reviews. Do not mutate `Review.status` from moderation in Phase 1, because it changes public rating/count/cache behavior. New central reports only reference review IDs. | High if later enforcement bypasses review service. |
| Listing lifecycle | Listing creation/editing and host routes exist; the schema has DRAFT, IN_PROGRESS, PENDING_REVIEW, CHANGES_REQUESTED, APPROVED, REJECTED, and ACTIVE states. | `Listing`; `app/api/v1/listings/*`, `app/api/v1/host/listings/*` | Listing approval is operational publishing workflow, not content-moderation workflow. The foundation validates listing/photo existence without changing listing state, availability, or indexing. | High if coupled later. |
| Authentication and roles | Live server context is resolved in [`lib/auth/context.ts`](../../lib/auth/context.ts) and [`lib/auth/session.ts`](../../lib/auth/session.ts); permissions are evaluated in [`lib/permissions/guards.ts`](../../lib/permissions/guards.ts). | `User.role`, optional `User.adminRoleId`, `AdminRole` | Server authorization is independent of dashboard links, so opening a URL cannot grant a user moderation authority. The schema has one primary role plus one admin-role assignment, not a general multi-role assignment table. Do not overwrite roles on dashboard switching; generalized multi-role RBAC remains a Phase 2/platform migration concern. | Medium / architectural. |
| Booking disputes | Booking-quality incidents and evidence are handled by [`services/dispute.service.ts`](../../services/dispute.service.ts), private evidence authorization, and dedicated host/admin routes. | `ListingQualityIncident`; `app/api/v1/admin/bookings/disputes/*`, `app/api/v1/host/disputes/*`, `app/api/v1/disputes/*` | These disputes can affect booking workflow and must remain separate. No existing dispute record was reused for content moderation. | Critical. |
| Notifications | Notification delivery and dispute recipient selection are in [`services/notification.service.ts`](../../services/notification.service.ts) and [`lib/notifications/dispute-destination.ts`](../../lib/notifications/dispute-destination.ts). | `Notification`; `/api/v1/notifications/*` | Notification destination/link does not confer permission; every moderation endpoint authenticates and authorizes again. No moderation notification is emitted in Phase 1. | High. |
| User-generated content and media | Listings expose descriptions/photos; users have profiles; messaging has conversations, messages, and protected attachments. | `Listing`, `User`, `Conversation`, `Message`, `MessageAttachment`; `/api/v1/upload/listing-photo`, `/api/v1/messages/*` | `REVIEW`, `LISTING`, `LISTING_PHOTO`, `PROFILE`, `USER`, and `MESSAGE` targets are validated. Listing photo IDs are existing photo URLs because there is no standalone listing-photo model. `OTHER_CONTENT` is catalogued but rejected until a concrete backed resource exists. | Medium. |
| Financial and booking operations | Payment, refund, payout, and booking services/migrations are independent of review and listing moderation. | `Booking`, `BookingPayment`, `BookingRefund`, payout records | The new migration does not alter finance or booking data, and moderation service has no cancellation/refund/payout/enforcement call. Future enforcement must invoke existing approved workflows explicitly. | Critical. |

## Architecture and data flow

`authenticated reporter → target/relationship validation → policy validation → transaction + advisory lock → existing active case match or new case → immutable report/activity entries`

Reports are individual submissions. An active case groups reports sharing target type, target ID, and category; a different category remains independently assessable. The transaction takes a PostgreSQL advisory lock keyed by reporter, target, category, and reason before checking for an existing reporter submission, so concurrent duplicate submissions do not create unlimited reports or cases.

Moderator changes are workflow records only: status, severity/priority, assignment, and resolution notes. They create append-only activity records for triage, assignment, status/reopen, decision, evidence, report attachment, and case creation. A decision is stored as resolution fields on the case, not as enforcement. The new foundation has no route that removes content or changes account, booking, refund, payment, or payout state.

Evidence uses an internal `storageReference`, `MODERATORS_ONLY` default scope, and restricted service access. The service intentionally strips the storage reference from return data; Phase 2 must add an authorized storage proxy before evidence files can be downloaded.

## Database changes

- New enums: `ModerationTargetType`, `ModerationCaseStatus`, `ModerationSeverity`, `ModerationEvidenceType`.
- New tables: `ModerationReport`, `ModerationCase`, `ModerationEvidence`, and `ModerationActivity`.
- Existing relations only: `User` gains submitted-report, assigned-case, evidence-submitter, and activity-actor relations; `Booking` gains optional related report history.
- Indexes support reporter history, target/category case lookup, active queues, assignment queues, evidence/activity timelines, and related bookings.
- Migration: [`prisma/migrations/20261014150000_moderation_foundation/migration.sql`](../../prisma/migrations/20261014150000_moderation_foundation/migration.sql). It is additive and contains no deletes, rewrites, or changes to Review, Listing, payment, refund, payout, or dispute tables.

### Migration safety

`prisma migrate status` found local migration history drift: the target database is missing local migrations `20261008150000_add_checkin_instruction_views` and `20261010140000_admin_booking_foundation`, while it records `20261007000000_add_host_guest_reviews` that is absent locally. Therefore this Phase 1 migration was generated and validated but **not applied** to that database. Do not run `prisma migrate deploy`, reset, or resolve history blindly. First reconcile the missing/extra history against the deployment source and take a database backup; then apply this additive migration in a disposable development database before staging/production.

## Code changes

- [`lib/moderation/policies.ts`](../../lib/moderation/policies.ts): versioned, code-owned policy catalogue with explicit target applicability and severity.
- [`services/moderation.service.ts`](../../services/moderation.service.ts): target/booking validation, duplicate-safe report creation, central case creation, lifecycle validation, permission-scoped case updates, evidence metadata, and append-only activity.
- [`app/api/v1/moderation/reports/route.ts`](../../app/api/v1/moderation/reports/route.ts): authenticated report creation and a caller-only paginated history.
- [`app/api/v1/admin/moderation/cases/route.ts`](../../app/api/v1/admin/moderation/cases/route.ts) and [`[id]/route.ts`](../../app/api/v1/admin/moderation/cases/[id]/route.ts): permission-gated queue and workflow update endpoints.
- [`lib/permissions/permissions.ts`](../../lib/permissions/permissions.ts): adds `moderation.report.create` plus case, evidence, decision, audit, policy, and future-enforcement permission concepts and dependencies.

No moderation dashboard, notification emission, report form, automated action, enforcement action, or financial behavior was added.

## Testing report

Passed locally:

- `npx prisma format`
- `npx prisma validate`
- `npx prisma generate`
- `npx tsc --noEmit`

Focused automated coverage is in [`__tests__/moderation-foundation.test.ts`](../../__tests__/moderation-foundation.test.ts). It covers policy applicability, lifecycle transitions, backend authorization guard presence, and the additive/no-finance/no-review-mutation migration boundary.

Database integration scenarios (invalid targets, cross-user report access, unrelated-host access, concurrent report creation/activity persistence, evidence authorization, and dispute/financial regression) cannot truthfully be run against the configured database until the recorded migration-history drift is reconciled. The service and routes are designed for those scenarios, but they are not marked as passed.

## Phase 2 readiness

Ready: centralized schema, target validators, report-to-case grouping, active-case queue query, lifecycle rules, permissions, audit trail, and safe API contracts.

Blockers before enabling a dashboard or enforcement:

1. Reconcile and apply migrations in a disposable development database, then run database integration tests.
2. Decide whether the product needs true multiple assigned roles. The present primary-role plus optional admin-role relationship preserves admin authorization when navigating but cannot represent arbitrary concurrent guest/host/admin assignments.
3. Approve an authorized evidence storage/download design and retention policy.
4. Approve the content-enforcement policy/workflows; enforcement must remain explicitly separated from booking cancellation, refunds, payments, and payouts.
