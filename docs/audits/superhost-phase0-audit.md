# Homyz — Superhost Phase 0 Audit

**Date:** 26 October 2026  
**Scope:** Phase 0 evidence audit only. No application code, Prisma schema, migrations, test files, or production data were changed.  
**Reference verified:** `Superhost Criteria.docx` at `/home/ubuntu/Documents/Criteria-20260519T114521Z-3-001/Criteria/Superhost Criteria.docx`.

## A. Executive summary

Homyz has a substantial Superhost implementation. It is a host-account-level, persisted quarterly program with a dedicated rules module, evaluator, immutable assessment history, authenticated internal trigger, deployment timer, host progress UI, and public badge propagation. It is not a listing-level calculation and is materially separate from Guest Favorite.

The system is **not ready to treat the Phase 0 baseline as fully correct**. Its review calculation conflicts with the reference requirement: code comments say a review qualifies when the reciprocal host review exists *or* its 14-day window expires, while the actual query only allows stays whose checkout is at least 14 days old. A newly reciprocal-published review is therefore omitted until day 14. The response-rate denominator and cancellation-exception provenance also require deliberate product/data decisions. Finally, the deployed scheduler is not verified, only runs on the first day of each assessment window, and a concurrent evaluator rerun can conflict at the unique history insert.

### Classified coverage count

| Classification | Count |
|---|---:|
| `IMPLEMENTED_VERIFIED` | 15 |
| `PARTIALLY_IMPLEMENTED` | 5 |
| `IMPLEMENTED_BROKEN` | 1 |
| `MISSING` | 0 |
| `NEEDS_PRODUCT_DECISION` | 1 |
| `NOT_VERIFIED` | 2 |
| **Total audited requirements / controls** | **24** |

The counts describe discrete requirements and operational controls, not code coverage. The central risk is data correctness at an official quarterly award, rather than absence of an overall system.

### Validation performed

- Read the actual source criteria document, Prisma schema/migration, Superhost, messaging, review, dashboard/insights, qualification, public-badge, API, scheduler, deployment-script, and test paths listed below.
- Ran the safe source-level test command:

  ```bash
  npx tsx -r dotenv/config --test \
    __tests__/phase7-superhost-evaluation.test.ts \
    __tests__/phase6-superhost-qualification.test.ts \
    __tests__/phase2-guest-favorite-correctness.test.ts \
    __tests__/phase8-public-badge-pipeline.test.ts \
    __tests__/property-card-badges-audit-fix.test.ts \
    __tests__/phase9-badge-consistency.test.ts \
    __tests__/host-insights-route-audit.test.ts \
    __tests__/phase7-host-insights-navigation.test.ts
  ```

  Result: **46 passed / 49 total**. The three failures are source-contract regressions outside the Superhost engine: two `phase7-host-insights-navigation` assertions still expect the previous header/custom-range implementation, and one badge test expects a retired `showGuestFavorite` identifier. The Superhost rules, lifecycle, scheduler-artifact, public pipeline, independence, and privacy source tests in this run passed. This is not a green regression baseline and must be reconciled in its assigned phase; no tests were edited in Phase 0.
- No authenticated browser run, controlled database fixture, deployed systemd timer inspection, or production history query was performed. Those controls are explicitly `NOT_VERIFIED` below.

## B. Requirement coverage matrix

Status terms are intentionally limited to the six classifications requested for this audit. “Verified” means current source plus available source-level tests, not a production-data assertion.

| ID | Document requirement | Status | Existing file / API | Evidence | Required action | Target phase |
|---|---|---|---|---|---|---|
| SH-01 | Superhost is host-account-level, not listing-level. | `IMPLEMENTED_VERIFIED` | `prisma/schema.prisma:427-430,522-548`; `services/superhost.service.ts:84-106` | Status lives on `User`; history is keyed by `hostId`; evaluator queries `Listing.hostId`. | REUSE — NO REIMPLEMENTATION. | — |
| SH-02 | Only a listing owner qualifies; co-hosts and experience/service-only hosts are excluded. | `IMPLEMENTED_VERIFIED` | `services/superhost.service.ts:90-105` | Ownership comes from `Listing.hostId`, not co-host grants; only `HOME` listings are eligible. | REUSE — NO REIMPLEMENTATION. Add adversarial E2E proof in Phase 5. | Phase 5 |
| SH-03 | Account must be in good standing. | `PARTIALLY_IMPLEMENTED` | `services/superhost.service.ts:84-88,187,195`; `lib/superhost/rules.ts:157-170` | Code treats only `UserStatus.ACTIVE` as good standing. The criteria document does not define whether compliance, payment, fraud, or suspension states beyond user status participate. | Confirm an authoritative good-standing policy; encode it in one reusable predicate. | Phase 2 |
| SH-04 | Performance aggregates all eligible owned listings. | `IMPLEMENTED_VERIFIED` | `services/superhost.service.ts:92-103,112-153` | All non-deleted HOME listing IDs owned by the host are used in booking and review aggregation. | REUSE — NO REIMPLEMENTATION. | — |
| SH-05 | Volume is `>=10` completed reservations OR `>=3` and `>=100` nights. | `IMPLEMENTED_VERIFIED` | `lib/superhost/rules.ts:130-170`; `services/superhost.service.ts:156-177` | Thresholds use exact inclusive comparisons; stay nights use shared booking-date utility. Boundary tests passed. | REUSE — NO REIMPLEMENTATION. | — |
| SH-06 | Only completed eligible stays count; cancellations/pending stays must not inflate volume. | `IMPLEMENTED_VERIFIED` | `services/superhost.service.ts:112-131,159-177`; `lib/booking/booking-status.ts` | Query selects confirmed/cancelled candidates; volume increments only when shared status computation returns `COMPLETED`. | REUSE — NO REIMPLEMENTATION. Exercise fixture cases in Phase 5. | Phase 5 |
| SH-07 | Previous 12 complete months are evaluated with correct quarterly and UTC boundaries. | `IMPLEMENTED_VERIFIED` | `lib/superhost/rules.ts:17-108`; `__tests__/phase7-superhost-evaluation.test.ts` | UTC checkpoints and prior-12-full-month window are deterministic and tested. | REUSE — NO REIMPLEMENTATION. | — |
| SH-08 | Overall rating is at least 4.8 from eligible, published guest property reviews. | `IMPLEMENTED_VERIFIED` | `lib/superhost/rules.ts:135`; `services/superhost.service.ts:132-149,179-181` | Query restricts to `PUBLISHED`, `GUEST_TO_PROPERTY`; comparison preserves 4.8 precision. | Reuse query shape after SH-09 is fixed. | Phase 1 |
| SH-09 | A review counts when both parties submit reviews **or** the 14-day window expires. | `IMPLEMENTED_BROKEN` | `lib/superhost/rules.ts:110-119`; `services/superhost.service.ts:132-145`; `prisma/schema.prisma:1484-1539` | Rules comment declares the two alternatives, but the Prisma predicate only includes a booking with `endDate <= asOf - 14 days`; it never checks the reciprocal host review. A reciprocal review published earlier is excluded until day 14. | Implement one final-review eligibility predicate/query using the two real release conditions; test reciprocal-before-day-14, day-14, unpublished, duplicate, and period boundaries. | Phase 1 |
| SH-10 | Reply to at least 90% of new messages within 24 hours. | `PARTIALLY_IMPLEMENTED` | `services/messaging.service.ts:1730-1814`; `lib/superhost/rules.ts:136,151-154` | The first guest-authored, non-system message and first host response are measured with an exact 24-hour boundary and 90% threshold. However, scope is conversation `createdAt`, not first qualifying message time, and no conversation-type / automation policy is applied. | Decide documented denominator and excluded message types; then make the shared metric reflect it. | Phase 1 |
| SH-11 | Host cancellation rate is strictly below 1%. | `IMPLEMENTED_VERIFIED` | `lib/superhost/rules.ts:137-146`; `services/superhost.service.ts:183-196` | Raw rate, not rounded display rate, is compared using strict `< 1`; denominator is explicitly completed stays plus non-excluded host cancellations. | REUSE — NO REIMPLEMENTATION. | — |
| SH-12 | Major Disruptive Events and valid Homyz exceptions are excluded from host cancellations. | `PARTIALLY_IMPLEMENTED` | `lib/superhost/rules.ts:122-128`; cancellation `priceBreakdown` selected at `services/superhost.service.ts:130,160-162` | Generic `priceBreakdown.cancellation.isExcluded` support exists, but there is no audited typed exception/MDE source or authorization trail proving which actor may set it. | Trace canonical cancellation exception ownership and preserve reason/provenance in the eligibility input. | Phase 1 |
| SH-13 | Evaluation occurs quarterly: Jan 1, Apr 1, Jul 1, Oct 1, with a seven-day assessment window. | `IMPLEMENTED_VERIFIED` | `lib/superhost/rules.ts:1-81`; `services/superhost.service.ts:382-387` | UTC quarter/month/day checks and seven-day window are centralized and tested. | REUSE — NO REIMPLEMENTATION. | — |
| SH-14 | An automated job performs the quarterly evaluation. | `NOT_VERIFIED` | `app/api/internal/superhost/evaluations/route.ts`; `deploy/homyz-superhost-evaluation.timer`; `scripts/deploy/run-superhost-evaluation.sh` | An authenticated internal endpoint and systemd timer artifact exist. Phase 0 could not establish that the timer is installed, enabled, has its secret, or has successfully run in the target environment. | Verify deployment configuration and record execution evidence. | Phase 3 |
| SH-15 | Seven-day assessment window has reliable retry/failure handling. | `PARTIALLY_IMPLEMENTED` | `services/superhost.service.ts:382-430`; `deploy/homyz-superhost-evaluation.timer:5-9`; `scripts/deploy/run-superhost-evaluation.sh:14-26` | Batch returns per-host failures; the request retries twice. The timer runs only on day 1, so an outage beyond the request retries has no automatic day-2-to-7 retry/alert path. | Add bounded assessment-window retries, durable run summary/alerting, and documented operator recovery. | Phase 3 |
| SH-16 | Status changes only at a quarterly checkpoint, automatically grants/losses/regains status, and requires no application. | `IMPLEMENTED_VERIFIED` | `services/superhost.service.ts:290-370`; `lib/superhost/rules.ts:102-108`; `services/qualification.service.ts:64-72` | The evaluator is date-gated; a transaction records a new snapshot and updates persisted `User.isSuperhost`. A future qualified checkpoint can set it true again; no application path is used. | REUSE — NO REIMPLEMENTATION. Validate with real fixture lifecycle in Phase 5. | Phase 5 |
| SH-17 | Historical assessment records, last evaluation, next evaluation, and retention of history after loss. | `IMPLEMENTED_VERIFIED` | `prisma/schema.prisma:427-430,522-548`; `services/superhost.service.ts:316-345,373-379` | Immutable-per-checkpoint history has a unique key; user fields retain official lifecycle state; loss updates the flag without deleting history. | REUSE — NO REIMPLEMENTATION. | — |
| SH-18 | Reruns cannot duplicate or partially update an official quarterly result. | `PARTIALLY_IMPLEMENTED` | `services/superhost.service.ts:308-346`; `prisma/schema.prisma:545` | Unique key and transaction protect data integrity, and sequential reruns return existing history. The check-then-create sequence can race between concurrent workers; one worker may receive a unique-key error and be reported as failed. | Use a concurrency-safe insert/upsert/retry pattern and test two simultaneous triggers. | Phase 3 |
| SH-19 | Badge appears on profile and owned listings and follows persisted official status. | `IMPLEMENTED_VERIFIED` | `services/qualification.service.ts:64-77`; `components/users/public-host-identity-card.tsx:16-42`; `lib/listings/card-badge.ts:15-22`; public listing DTO mappings | Public presentation reads persisted `host.isSuperhost`, not live progress; cache invalidation occurs after an official status change. Badge pipeline/privacy tests passed. | REUSE — NO REIMPLEMENTATION; run browser rendering checks. | Phase 5 |
| SH-20 | Superhost and Guest Favorite are separate: host/quarterly vs listing/daily, and may coexist. | `IMPLEMENTED_VERIFIED` | `services/qualification.service.ts:1-77`; `lib/listings/card-badge.ts:8-22`; Guest Favorite service/tests | Separate persisted fields/engines and source-level four-combination tests demonstrate independence. `getPrimaryListingBadge` has a presentation priority only; it does not alter qualification. | REUSE — NO REIMPLEMENTATION. | — |
| SH-21 | Host can see official status, current progress, next assessment, and assessment history without exposing internal weights publicly. | `IMPLEMENTED_VERIFIED` | `services/host-dashboard.service.ts:1194-1210,1653-1680`; `services/host-insights.service.ts:298-356,452-459`; `components/host/insights/insights-superhost-tab.tsx`; `/api/v1/host/insights/superhost*` | Host UI distinguishes “Official Superhost”, “Eligible at next assessment”, and in-progress. Public badge tests establish only public flag exposure; no internal weighting is returned publicly. | REUSE — NO REIMPLEMENTATION; browser/accessibility proof belongs in Phase 5. | Phase 5 |
| SH-22 | Private status/history is authorized and cannot be client-awarded. | `IMPLEMENTED_VERIFIED` | `app/api/v1/host/insights/superhost/route.ts:9-23`; history route `:9-12`; internal route `:7-31` | Host/admin role guard protects host routes; internal trigger requires timing-safe bearer comparison; evaluation writes happen server-side in a Prisma transaction. | REUSE — NO REIMPLEMENTATION; add adversarial API verification. | Phase 5 |
| SH-23 | Good-standing, response denominator, and cancellation denominator must not be silently invented. | `NEEDS_PRODUCT_DECISION` | `services/superhost.service.ts:183-196`; `services/messaging.service.ts:1765-1803` | Current code supplies defensible defaults, but the document defines only the final thresholds—not a complete standing policy, what counts as a new message, automated replies, or cancellation denominator. | Product must approve these definitions before Phase 1 changes calculations. | Phase 1 |
| SH-24 | Actual database state, scheduler execution, and authenticated browser behavior match source. | `NOT_VERIFIED` | Runtime/deployment environment | Schema/migration and source artifacts exist, but no non-mutating fixture reconciliation, live timer inspection, or browser test was available in this audit. | Execute the Phase 5 scenario matrix against controlled data and deployed scheduler logs. | Phase 5 |

## C. Existing architecture

### Persistence and relationships

- `User.isSuperhost`, `superhostQualifiedAt`, `superhostLastEvaluatedAt`, and `superhostNextEvaluationAt` are account-level state in `prisma/schema.prisma:427-430`.
- `SuperhostEvaluation` (`prisma/schema.prisma:522-548`) stores a checkpoint, twelve-month window, source metrics, qualification result, and failure reasons. `@@unique([hostId, evaluationDate])` is the intended historical idempotency boundary.
- `Listing.hostId` is the ownership relationship. `services/superhost.service.ts:90-105` deliberately does not use `ListingCoHost`; `hostingType === "HOME"` is the eligible inventory filter.
- `Booking` provides confirmation/cancellation candidates, dates, and the cancellation payload. Completed status and booking nights are calculated through shared booking utilities rather than copied logic.
- `Review` has `bookingId`, `direction`, `status`, `submittedAt`, `publishedAt`, and `reviewDeadline` (`prisma/schema.prisma:1484-1539`). The unique `[bookingId, direction]` prevents duplicate reviews of the same direction.
- `Conversation`/`Message` are queried by the shared `messagingService.calculateHostResponseMetrics` function.

### Runtime flow

```text
Owned HOME listings
  ├─ confirmed/cancelled bookings ──► completed stays, nights, host cancellations
  ├─ published guest-property reviews ─► average rating / review count
  └─ guest conversations + messages ──► 24-hour response metric
                                         │
User standing ──────────────────────────┤
                                         ▼
                         lib/superhost/rules.ts
                                         ▼
                     services/superhost.service.ts
                         ├─ live progress for host dashboard/insights
                         └─ quarterly transaction → SuperhostEvaluation + User.isSuperhost
                                                        │
                      qualification.service.ts / public DTOs / host UI / cache invalidation
```

### Services, API, job, and UI

- Rules: `lib/superhost/rules.ts` owns dates, thresholds, raw-rate precision, review cutoff helper, and generic cancellation exclusion.
- Engine: `services/superhost.service.ts` calculates live progress, finalizes a checkpoint, returns history, and batches a quarterly run.
- Metric dependency: `services/messaging.service.ts:1734-1814` owns the response calculation. `services/host-dashboard.service.ts` and `services/host-insights.service.ts` serialize the official and live views.
- Scheduled trigger: `POST /api/internal/superhost/evaluations`; `deploy/homyz-superhost-evaluation.timer`; `deploy/homyz-superhost-evaluation.service`; `scripts/deploy/run-superhost-evaluation.sh`.
- Private host routes: `GET /api/v1/host/insights/superhost` and `GET /api/v1/host/insights/superhost/history`.
- UI: `components/host/insights/insights-superhost-tab.tsx`, `app/(protected)/host/insights/superhost/history/page.tsx`, dashboard DTO consumers, and `components/users/public-host-identity-card.tsx`.
- Public badge source of truth: `services/qualification.service.ts` returns `host.isSuperhost`; listing-card badge priority lives in `lib/listings/card-badge.ts`.

## D. Critical logic findings

### D1 — P0 correctness: reciprocal reviews are not counted before day 14

`lib/superhost/rules.ts:110-119` says a guest review becomes eligible when a reciprocal host review exists **or** 14 days have elapsed. However, `services/superhost.service.ts:132-145` only filters the booking with `endDate <= reviewWindowExpiryCutoff`. No predicate reads the reciprocal `HOST_TO_GUEST` review for that booking. This means a guest review that is correctly published as soon as both parties submit is not eligible for Superhost rating until the 14th day after checkout.

**Reproduction from source:** use a completed booking whose checkout was seven days ago, a published `GUEST_TO_PROPERTY` review, and a published reciprocal `HOST_TO_GUEST` review. The review publication flow may make it public, but `endDate <= asOf - 14 days` is false, so the aggregate ignores it.

This is a qualification data error and must be corrected before trusting an award at a checkpoint. It is assigned once to Phase 1.

### D2 — P1 reliability: timer does not cover the seven-day recovery window

The timer runs only once on the first day of January, April, July, and October (`deploy/homyz-superhost-evaluation.timer:5-9`). The script retries HTTP transport twice (`scripts/deploy/run-superhost-evaluation.sh:14-26`), while the service itself permits days 1–7 (`services/superhost.service.ts:382-387`). If the timer host/application is unavailable past those two retries, no automated retry occurs on days 2–7 and failures have only process logging/response output.

### D3 — P1 reliability: sequential idempotency is not concurrent idempotency

Within a transaction, the evaluator calls `findUnique` then `create` (`services/superhost.service.ts:308-335`). The database unique key prevents two history rows, but two concurrent workers can both observe no record and one will fail the unique insert. The data remains protected, yet the run is falsely reported as a failed host and leaves no explicit conflict recovery.

### D4 — P1 data semantics: response-rate population does not exactly model “new messages”

`calculateHostResponseMetrics` selects conversations by `Conversation.createdAt` and counts only the first guest-authored non-system message (`services/messaging.service.ts:1738-1784`). A new guest message in a pre-existing conversation is excluded; a conversation created in the window may count its first message even if its business context is not a fresh inquiry. The code has no explicit policy for automated replies. The 24-hour comparison itself is correct. Product must define the qualifying message population before changing this metric.

### D5 — P1 auditability: cancellation exception policy is an untyped JSON switch

`isNonExcludedHostCancellation` trusts `priceBreakdown.cancellation.cancelledBy === "HOST"` and `isExcluded !== true` (`lib/superhost/rules.ts:122-128`). It supports exclusion but Phase 0 found no typed Major Disruptive Event/valid-exception relation or audited approver trail in the calculation path. Do not replace the formula; first establish the canonical cancellation exception record and writer policy.

### D6 — product decision: good standing is currently only `UserStatus.ACTIVE`

The code makes a clear and safe implementation choice (`services/superhost.service.ts:187`), but the document does not define whether all compliance/payment/fraud/restriction conditions collapse to that state. This is not a code defect until product confirms the policy.

## E. Reusable functionality

Later phases must extend these sources rather than introduce a second engine:

- `lib/superhost/rules.ts`: quarter windows, 12-month window, volume/threshold evaluator, exact cancellation-rate comparison.
- `services/superhost.service.ts`: owner/HOME-listing scope, shared booking status computation, transaction that persists official status/history, cache invalidation, notification, and batched runner.
- `services/messaging.service.ts`: the one authoritative response-metric function. Amend its documented input semantics rather than calculate response rates in a dashboard or UI component.
- `lib/booking/booking-status.ts` and `lib/booking/booking-date.ts`: completed-stay and duration semantics.
- `services/qualification.service.ts`: public status resolution must continue to read persisted `User.isSuperhost`, never live progress.
- Guest Favorite’s service and `lib/listings/card-badge.ts`: reuse the existing separate presentation contract; do not merge the programs.
- `SuperhostEvaluation` schema/migration and internal endpoint: retain backward compatibility and history structure.

## F. Missing or broken functionality backlog

| Priority | Finding | Classification | Assigned phase | Completion evidence |
|---|---|---|---|---|
| P0 | Reciprocal-review eligibility is missing from rating aggregation. | `IMPLEMENTED_BROKEN` | Phase 1 | Fixture proves reciprocal review counts before day 14; unpaired review waits to expiry. |
| P1 | Response-rate denominator/type/automation semantics are incomplete. | `PARTIALLY_IMPLEMENTED` | Phase 1 | Approved policy plus tests for existing conversations, system/automated messages, repeated messages, and exact 24h. |
| P1 | Cancellation exclusion has no confirmed canonical exception provenance. | `PARTIALLY_IMPLEMENTED` | Phase 1 | Typed/authoritative source and tests for host, guest, MDE, and authorized exception cases. |
| P1 | Good-standing definition is not fully specified. | `NEEDS_PRODUCT_DECISION` | Phase 2 | Approved policy exercised by engine tests. |
| P1 | Scheduler has no automatic recovery across days 2–7. | `PARTIALLY_IMPLEMENTED` | Phase 3 | Missed-day/failure retry, durable run record/alert, and operator recovery test. |
| P1 | Concurrent quarterly triggers can surface unique-key failure. | `PARTIALLY_IMPLEMENTED` | Phase 3 | Parallel trigger test returns one immutable official result without a failed host. |
| P1 | Installed/enabled scheduler and historical execution are unproven. | `NOT_VERIFIED` | Phase 3 | Controlled deployment inspection and signed/logged successful run. |
| P2 | Source-contract test debt prevents a green audit baseline. | `NOT_VERIFIED` | Phase 4 | Existing assertions align with retained badge/header contracts; relevant test selection is green. |
| P2 | Browser/accessibility/cache propagation with real data is unproven. | `NOT_VERIFIED` | Phase 5 | Authenticated host/guest browser matrix plus controlled data reconciliation. |

No required reference-document capability was classified `MISSING`: the system exists end-to-end. The listed work corrects or verifies the existing implementation.

## G. Product decisions required

1. **Good standing:** Is `UserStatus.ACTIVE` the complete policy, or must particular compliance, payment, fraud, dispute, or restriction states also make a host ineligible? Identify the authoritative source and precedence.
2. **Response rate:** Define “new message” precisely: initial inquiry only vs each guest message needing a first reply; inclusion of booking conversations; treatment of automated replies; and behavior for a conversation initiated before the measurement window.
3. **Cancellation denominator and exceptions:** The implementation uses completed stays plus non-excluded host cancellations. Confirm this denominator, which exception reason codes qualify, and who can set/approve `isExcluded`.
4. **Assessment effective time:** The document supplies a seven-day window but not whether a successful day-2–7 rerun is officially effective as of day 1, or how a corrected historical input is handled after finalization. The current design treats the checkpoint date as official and makes history immutable; keep or amend this deliberately.

## H. Final fixed phase mapping

This allocation is fixed to prevent duplicate engines and repeated audits. A row is assigned to one implementation phase only.

| Phase | Scope | Fixed work allocation |
|---|---|---|
| Phase 1 — Eligibility Data & Performance Metrics | Correct the inputs to the existing engine. | SH-09 reciprocal/expiry review eligibility; SH-10 response population after product decision; SH-12 canonical cancellation exceptions; fixtures for completed stays and 12-month boundaries. **REUSE** rules engine, booking utilities, and messaging service. |
| Phase 2 — Superhost Qualification Engine | Apply approved policy in one engine. | SH-03 good-standing predicate; wire Phase 1 canonical inputs into `calculateSuperhostProgress`; preserve existing thresholds, windows, status fields, and history. **REUSE — NO REIMPLEMENTATION** for threshold/ownership/volume logic. |
| Phase 3 — Quarterly Automatic Evaluation & Lifecycle | Make the existing automatic lifecycle resilient. | SH-14 deployed timer proof; SH-15 seven-day recovery/observability; SH-18 concurrency-safe finalization. **REUSE** internal endpoint, timer/service, transaction, history, invalidation, and notification. |
| Phase 4 — Badge, Profile & Listing Integration | Retain public persisted status and prove its presentation contract. | Reconcile stale source-contract tests and test all Guest Favorite/Superhost display combinations after official award/loss. **REUSE — NO REIMPLEMENTATION** for `qualification.service.ts`, public DTO mappings, and badge components. |
| Phase 5 — Final End-to-End Testing | Prove the integrated system with real controlled data. | Authenticated host/guest/admin APIs, multi-listing owner/co-host exclusion, award/loss/regain, public cache propagation, scheduler dry run/log review, accessibility, and database/UI reconciliation. No new eligibility or badge engine. |

## I. Implementation readiness

### Exact Phase 1 scope

1. Create/identify one reusable review-finalization query/helper that includes a published guest property review when the host reciprocal review exists **or** the review deadline has elapsed; keep publication/moderation semantics authoritative.
2. Adopt the approved response-rate population in `messagingService.calculateHostResponseMetrics`; do not add a dashboard-specific metric.
3. Trace cancellation exception writes and pass one canonical, auditable exclusion signal into the existing cancellation rule.
4. Add focused unit/integration fixtures for review timing, message timing, cancellation classes, multiple owned listings, co-host exclusion, completed stays, and UTC boundaries.

### Dependencies

- Product answers for the decisions in Section G, especially response and standing policies.
- Existing review publication data must expose reciprocal/finalization state safely and efficiently.
- The cancellation domain owner must identify the canonical MDE/exception source and authorization path.
- Controlled test fixtures are required; no production status changes should be used as test data.

### Phase 1 acceptance criteria

- A guest review qualifies exactly when reciprocal review publication occurs or the 14-day deadline expires; it is not counted before either event.
- Rating calculation is limited to eligible owned HOME listings and the same quarterly performance window.
- Response rate reflects the approved definition, uses the exact 24-hour edge, and has no duplicate denominator entries.
- Host cancellation rate excludes approved MDE/valid exceptions and still applies raw strict `<1%` comparison.
- Existing volume, owner, UTC, persisted-status, and Guest Favorite independence tests remain green, plus new data-fixture tests.
- No new Superhost status field, duplicate evaluator, or client-awarded badge is introduced.

### Likely Phase 1 modification points

- `services/superhost.service.ts`
- `lib/superhost/rules.ts`
- `services/messaging.service.ts`
- Existing review/cancellation service or schema **only if** the product-approved canonical data cannot be represented through existing persisted fields
- Focused files under `__tests__/` for the specified scenarios

### Remaining blockers after Phase 0

- Product definitions in Section G.
- Confirmation of the actual deployed scheduler environment and secret management.
- A controlled database fixture/browser environment for Phase 5.
- Reconciliation of the three non-engine source-contract test failures before declaring any release baseline green.

## Audit boundary and handoff

This report is the authoritative Superhost baseline for Phases 1–5. Future work should reinspect only a subsystem changed by new evidence or implementation, preserve API/database compatibility, and extend the listed services rather than creating a second eligibility calculator or badge system.
