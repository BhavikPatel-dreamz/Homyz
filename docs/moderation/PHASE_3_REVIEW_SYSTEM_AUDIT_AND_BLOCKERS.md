# Phase 3 — Review Management Audit and Required Decisions

## Verified current implementation

| Area | Verified behavior | Source |
| --- | --- | --- |
| Review data model | A `Review` is listing-bound, has one `authorId`, optional globally-unique `bookingId`, overall/category ratings, private host feedback, and `PUBLISHED`/`HIDDEN`/`DELETED`/`PENDING_MODERATION` status. | `prisma/schema.prisma` (`Review`) |
| Guest eligibility | Only the booking guest can submit, the booking must be `CONFIRMED`, tied to the listing, and have ended. A duplicate booking review is rejected. | `services/review.service.ts#createReview` |
| Publication | Eligible guest reviews publish immediately. Public and host APIs return only `PUBLISHED` reviews. | `services/review.service.ts`; `app/api/v1/listings/[id]/reviews/route.ts` |
| Private feedback | `privateNoteToHost` is returned only by the host listing review endpoint after ownership/co-host checks. | `app/api/v1/listings/[id]/reviews/host/route.ts` |
| Property rating | Public listing summaries query only published reviews; create/delete invalidates listing cache and re-evaluates guest-favorite data. | `services/review.service.ts`; `services/listing.service.ts` |
| Existing admin UI | Admin listing review UI is for listing-approval/audit workflow, not review moderation. No central review-management dashboard or review-detail route exists. | `app/(protected)/admin/listings/[id]/admin-listing-review-view.tsx` |
| Moderation integration | Phase 1 can validate `REVIEW` targets and create linked reports/cases, but the configured database does not yet contain those moderation tables. | `services/moderation.service.ts`; Phase 1 migration |

## Blocking gaps

1. `Review.bookingId` is globally unique. It cannot represent both a guest-to-property review and a host-to-guest review for one booking.
2. There is no review-direction/reviewed-user field, response table, publication deadline, publication timestamp, edit-window timestamp, visibility decision history, or review-action audit model.
3. Current reviews publish immediately. Replacing this with double-blind publication changes product behavior and requires a migration/backfill plan and approved policy.
4. The current database migration history is divergent and the moderation migration itself is not applied. Schema-backed Phase 3 functionality cannot be safely deployed until it is reconciled.

## Decisions required before implementation

- Approve the review model migration: extend the existing `Review` model for direction, reviewed user, deadline/publication metadata, and add append-only response/action history. This preserves current reviews rather than creating a competing review system.
- Confirm the 14-day review window, eligible cancellation rule, and whether existing immediately-published reviews retain legacy behavior or enter the new reciprocal publication policy.
- Confirm rating impact: hidden/removed reviews should be excluded from public listing aggregates; restoration should re-include them. No historical rating rewrite should happen without a separately reviewed reconciliation job.
- Reconcile Prisma migration history and apply the already-approved additive moderation migration in a disposable environment before any Phase 3 migration is introduced.

## Safe next implementation sequence

1. Reconcile migration history and deploy the Phase 1 moderation schema.
2. Approve the decisions above.
3. Add a backward-compatible review migration and database-level duplicate constraint scoped by booking and review direction.
4. Implement submission/publication/response services, then admin review dashboard/actions and targeted integration tests.

No review, booking, rating, financial, or moderation records were modified during this audit.
