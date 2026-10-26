# HOMYZ — Dashboard Final Pending Requirements Closure

**Closure date:** 26 October 2026  
**Baseline:** `HOMYZ_STANDARD_PLUS_NON_AI_FINAL_REQUIREMENTS_AUDIT.md`  
**Scope:** Feasible non-AI closure work only. Existing dashboard architecture, calculations, routes and entitlement engine were preserved.

## Outcome

The prior regression baseline has been restored and an independently implementable Plus gap—durable first-party inquiry-to-confirmed-booking attribution—has been closed for new data. The implementation never reconstructs historical attribution and never persists raw browser session IDs or guest identifiers in analytics events.

The result is **not a complete production sign-off** because the original DOCX specifications remain inaccessible, database/browser/provider checks could not be executed with an authorized representative environment, and external competitor/market data remains unavailable by design. It is now suitable for a controlled deployment once the remaining release evidence is obtained.

## Completed changes

### Restored regression baseline

- Updated `__tests__/phase-b-access-control.test.ts` to assert the correct relational `HostPayoutMethod` ownership query and retained legacy-fallback host scoping. It no longer expects the retired JSON-only implementation.
- Updated `__tests__/phase8-host-insights-reviews.test.ts` to assert the existing `returnTo` default and `BackButton` navigation contract, rather than requiring a literal anchor that is not rendered.
- The former two failures were confirmed as stale test expectations, not functional regressions.

### Durable inquiry-to-booking attribution

- Reused the existing booking-linked `Conversation` relationship and its durable `INQUIRY` analytics event; no database schema change is required.
- When a booking is confirmed, telemetry writes `INQUIRY_TO_CONFIRMED_BOOKING` only if the same booking-linked conversation has the durable inquiry event for that guest and listing.
- Host acceptance and bulk approval now also send best-effort confirmation telemetry. Failed telemetry does not affect booking confirmation.
- Listing Performance now displays an **Inquiry to booking** count with a precise first-party provenance explanation.
- Added/updated source-contract coverage in `phase2-plus-non-ai-completion.test.ts`.

## Requirement closure matrix

`Previous` reflects the audit baseline. `Current` is based on the code and tests executed in this closure. A `PARTIAL`, `UNVERIFIED`, or `EXTERNAL_BLOCKED` row is not counted as complete.

| ID | Previous → Current | Closure evidence / remaining dependency |
|---|---|---|
| S01 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Shared dashboard financial service; fixture regression passed. Live DB/API/UI reconciliation remains required. |
| S02 | PARTIAL → PARTIAL | Payout status is distinct from settlement; live rail verification remains unavailable. |
| S03 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Calendar/inventory span tests pass. |
| S04 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Dashboard regression passes. |
| S05 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Dashboard/opportunity source tests pass; browser traversal remains unrun. |
| S06 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Calendar and reservation source tests pass. |
| S07 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Checkout-exclusive, deduplicated inventory test passes. |
| S08 | PARTIAL → PARTIAL | Booking source and price-overlay provenance needs populated-data verification. |
| S09 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Calendar/dashboard calculations pass. |
| S10 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Guest/stats tests pass. |
| S11 | UNVERIFIED → UNVERIFIED | No authenticated browser/map/geography fixture was available. |
| S12 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Returning-guest test coverage passes. |
| S13 | PARTIAL → PARTIAL | Forward-only check-in tracking is tested; historical coverage remains intentionally unavailable. |
| S14 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Review-detail route contract corrected; review suite passes. |
| S15 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Review trend/distribution tests pass. |
| S16 | PARTIAL → PARTIAL | Reply/action source paths pass; authenticated reply workflow not executed. |
| S17 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Financial consistency and transaction tests pass. |
| S18 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Upcoming/paid ledger tests pass; provider settlement is still external. |
| S19 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Ownership and transaction-detail tests pass. |
| S20 | PARTIAL → PARTIAL | First-party listing telemetry exists; real data freshness/provenance needs a populated dataset check. |
| S21 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Stats tests pass. |
| S22 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Superhost tests pass. |
| S23 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Opportunity authorization/lifecycle tests pass. |
| S24 | UNVERIFIED → UNVERIFIED | Desktop/tablet/mobile, keyboard and accessibility E2E were not available. |
| P01 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Advanced earnings/RevPAN tests pass. |
| P02 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Immutable financial snapshot analytics tests pass. |
| P03 | PARTIAL → PARTIAL | Booking-source revenue has code evidence but needs source-normalization reconciliation. |
| P04 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Transaction/itemization tests pass. |
| P05 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Recorded-expense/profit tests pass. |
| P06 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Filter persistence, comparison and paginated property table tests pass. |
| P07 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Lead-time/last-minute tests pass. |
| P08 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Heatmap/stay-duration tests pass. |
| P09 | PARTIAL → PARTIAL | Historical inventory/block/timezone reconciliation needs a controlled database fixture. |
| P10 | PARTIAL → VERIFIED_COMPLETE | Existing durable inquiry-conversation-to-booking relationship plus privacy-preserving event and focused test pass. Only future linked records are counted. |
| P11 | PARTIAL → PARTIAL | Historical set-price versus booked-price identity remains incomplete for data not already recorded. |
| P12 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Observed (not predictive) demand/seasonality paths remain tested. |
| P13 | PARTIAL → PARTIAL | Rule input explanation requires populated pricing-observation verification. |
| P14 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Rule-based recommendations remain evidence-scoped; no AI/automatic price changes added. |
| P15 | PARTIAL → PARTIAL | Same-platform comparable observations exist; selection/timestamp verification needs representative data. |
| P16 | EXTERNAL_BLOCKED → EXTERNAL_BLOCKED | No authorized/licensed competitor occupancy/history/new-listing provider. Unsupported facts remain suppressed. |
| P17 | PARTIAL → PARTIAL | Available first-party booking facts exist; broader market/search data needs a data contract. |
| P18 | EXTERNAL_BLOCKED → EXTERNAL_BLOCKED | No approved event/market provider or integration contract. |
| P19 | PARTIAL → PARTIAL | Trip-purpose/segment provenance requires representative records. |
| P20 | PARTIAL → PARTIAL | Returning guest identity and multi-currency LTV requires controlled data reconciliation. |
| P21 | PARTIAL → PARTIAL | Pre-arrival tracking remains forward-only where recorded. |
| P22 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Operations route, lifecycle and entitlement source tests pass. |
| P23 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Recorded-cost/profit calculation tests pass. |
| P24 | PARTIAL → PARTIAL | Event capture/dedupe exists; live instrumentation completeness/freshness needs production-like verification. |
| P25 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Rule-based listing recommendations and tracking tests pass. |
| P26 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Standard/paid/admin/expired/revoked/suspended entitlement tests pass. |
| P27 | VERIFIED_COMPLETE → VERIFIED_COMPLETE | Direct server-side Plus API gates and access-control tests pass. |
| P28 | PARTIAL → PARTIAL | Listing scope is enforced, but adversarial accepted/revoked co-host browser/API scenarios and granular financial delegation evidence remain outstanding. |

All 18 AI rows remain `AI_DEFERRED`; no AI feature was substituted, enabled or counted as non-AI completion.

## Verification performed

| Check | Result |
|---|---|
| `npx prisma generate` | PASS |
| `npx tsc --noEmit --pretty false` | PASS |
| `npm run build` | PASS — compiled, type checked and generated 160 static pages |
| Original 77 selected dashboard regression tests | PASS — 77/77 |
| Focused closure suite (Plus, reviews, entitlement, access, analytics) | PASS — 42/42 |
| `git diff --check` | PASS |
| Full repository `npm run lint` | TIMED_OUT after approximately nine minutes without emitting findings; not reported as a pass |
| Targeted lint of touched paths | BLOCKED by pre-existing `no-explicit-any` errors in `services/booking.service.ts` and `services/messaging.service.ts` (71 errors), plus existing warnings. No new lint error was identified in the new attribution code. |
| Database → service → API → UI reconciliation | NOT_RUN — no controlled/authorized representative database fixture supplied. |
| Authenticated browser E2E / responsive / accessibility | NOT_RUN — no test tenant/browser harness supplied. |
| Provider, PayPal, banking, competitor and market integration checks | NOT_RUN / EXTERNAL_BLOCKED — credentials or approved providers unavailable. |

## Files changed for this closure

- `services/listing-analytics.service.ts`
- `services/messaging.service.ts`
- `services/booking.service.ts`
- `services/host-listing-performance.service.ts`
- `app/(protected)/host/insights/listing-performance/host-listing-performance-client.tsx`
- `__tests__/phase-b-access-control.test.ts`
- `__tests__/phase8-host-insights-reviews.test.ts`
- `__tests__/phase2-plus-non-ai-completion.test.ts`

Other pre-existing dirty-worktree files were preserved and are not attributed to this closure.

## Completion and readiness

Counting only `VERIFIED_COMPLETE` non-AI rows:

| Scope | Complete / total | Coverage |
|---|---:|---:|
| Standard Dashboard | 17 / 24 | **70.8%** |
| Dashboard Plus non-AI | 15 / 28 | **53.6%** |
| Combined non-AI | 32 / 52 | **61.5%** |
| AI | 18 / 18 | **Deferred, not implemented** |

## Remaining release blockers

1. Provide the two original DOCX files or authoritative exports; `SOURCE_VERIFICATION_INCOMPLETE` remains open.
2. Execute independent database → service → API → UI reconciliation with identical period/property/currency definitions.
3. Execute authenticated browser/accessibility/responsive and explicit cross-host/co-host adversarial scenarios.
4. Close or scope the legacy repository lint debt; the full lint run did not complete in the available environment.
5. Keep competitor occupancy/history, event intelligence and provider-settlement claims unavailable until licensed provider credentials, contracts and tests exist.

**Final readiness verdict: `CONDITIONAL_RELEASE` for the implemented, tested feature set; `NOT_PRODUCTION_READY` for full documented Standard + non-AI Plus compliance.** The 77-test dashboard baseline is green and the feasible attribution gap is closed, but production-wide sign-off remains blocked by the listed evidence and external-data dependencies.
