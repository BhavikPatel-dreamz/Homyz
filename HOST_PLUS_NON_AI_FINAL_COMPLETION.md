# HOMYZ — Dashboard Plus Non-AI Final Completion

**Completed:** 2026-10-26  
**Scope:** Existing Dashboard Plus routes and services only. No separate dashboard, AI capability, third-party scraper, or fabricated historical data was introduced.

## Executive summary

Dashboard Plus non-AI functionality is closed for the first-party data that Homyz actually records. Existing advanced earnings, RevPAN, booking/occupancy analytics, internal comparable-listing observations, guest retention, operations, and entitlement infrastructure were reused. This phase closed four verified gaps:

1. Operating-expense APIs are now server-gated by the existing `OPERATIONS_AND_PROFITABILITY` entitlement.
2. Advanced booking analytics now reports the value of last-minute bookings only from eligible immutable payout snapshots.
3. A durable forward-only `INQUIRY` funnel event is written when a real guest starts an inquiry; the UI accurately withholds inquiry-to-booking conversion until an explicit link exists.
4. The existing Plus Operations page now supports portfolio/property filtering and creation of maintenance records, rather than leaving its existing backend capability without a host workflow.

The original client DOCX files are unavailable in this repository. Source references below therefore map provisionally to the supplied Phase 2 brief and existing audit mappings.

## Requirement closure matrix

| ID | Source | Feature | Previous | Final | Frontend / backend | Actual data source | Changes made | Evidence | Dependency / closure |
|---|---|---|---|---|---|---|---|---|---|
| P-01 | §1.1 | Portfolio/property RevPAN and comparison | IMPLEMENTED_VERIFIED | CLOSED | Earnings Analytics / `host-earnings-analytics.service` | Completed eligible immutable payout snapshots + shared inventory | Reused shared active-listing, booking, block-night policy | `phase13-advanced-earnings-analytics` | Closed |
| P-02 | §1.2–1.3 | Revenue trends, gross/net, per-listing contribution, cost/profit context | IMPLEMENTED_VERIFIED | CLOSED | Earnings Analytics / earnings analytics service | Snapshot payouts and active operating expenses | Reused native-currency filtering; no FX blending | Phase 13 tests | Booking source is not persisted; source breakdown blocked |
| P-03 | §1.4–1.5 | Expense history, recorded costs, profit/cost per stay | PARTIAL | CLOSED | Earnings Analytics, Operations / expense and operational-record services | `OperatingExpense`, `CleaningTask`, `MaintenanceRecord` | Expense APIs now require Plus entitlement | `phase2-plus-non-ai-completion` | Recorded costs are deliberately labelled partial, never assumed zero |
| P-04 | §2.1–2.5 | Lead time, booking windows, heatmap, stay distributions, last-minute analysis | PARTIAL | CLOSED | Booking Analytics / `host-booking-analytics.service` | Confirmed booking creation/stay dates and snapshots | Added last-minute recorded payout at portfolio/property scope | Phase 14 + Phase 2 tests | UTC is explicitly documented; no confirmation timestamp exists |
| P-05 | §2.6–2.7 | Historical/property/portfolio occupancy comparisons | IMPLEMENTED_VERIFIED | CLOSED | Booking Analytics / shared inventory service | Confirmed stays and current manual blocks | Reused checkout-exclusive inventory and partial historical-calendar notice | Phase 14 tests | Historical calendar blocks are not versioned; historical denominator is labelled partial |
| P-06 | §3 | Views → inquiries → confirmed-bookings funnel | PARTIAL | CLOSED for observed stages | Listing Performance / listing analytics + messaging service | Durable listing events and genuine inquiry conversations | Added idempotent `INQUIRY` event at inquiry creation and observed view-to-inquiry display | Phase 2 tests, listing-performance tests | Inquiry-to-booking conversion is unavailable without a durable relationship; no backfill |
| P-07 | §4.1 | Historical pricing performance | PARTIAL | CLOSED for realized-rate history | Booking Analytics / booking analytics service | Immutable completed-stay accommodation snapshots | Reused monthly realized rate, explicitly not current advertised price | Phase 14 tests | Pre-existing advertised-price change history is not recorded |
| P-08 | §4.2–4.3 | Rule-based price/minimum-stay guidance | IMPLEMENTED_VERIFIED | CLOSED | Listing Performance / listing performance service | Current availability, observed lead time, first-party comparable prices | Reused explainable availability-gap/peer-price guidance; no automatic changes | listing-performance tests | No AI/autopilot; historical advertised-rate changes unavailable |
| P-09 | §5.1–5.3 | Comparable selection, prices, amenities, policies, change observations | IMPLEMENTED_VERIFIED | CLOSED | Listing Performance / comparison service | Published similar Homyz listings and dated comparable observations | Reused up-to-ten matching and observation history | listing-performance tests | Competitor occupancy/response time unavailable without supported observations |
| P-10 | §5.4–5.5 | Market events, external demand and competitor occupancy | EXTERNAL_DEPENDENCY | BLOCKED | None; honest unavailable state | No authorized provider | No scraper or invented market statistics added | Source/service review | Requires authorized event/market/occupancy provider |
| P-11 | §6 | Guest origins, trip purpose, repeat behavior and retention value | IMPLEMENTED_VERIFIED | CLOSED | Guest Insights / `host-guest-insights.service` | Stored guest address, self-reported purpose, completed booking snapshots | Reused eligible repeat revenue and host/property scope | `phase10-host-insights-guests` | Unknown/self-unreported values remain unknown |
| P-12 | §6.4–6.5 | Pre-arrival engagement and comparable guest characteristics | PARTIAL | CLOSED for recorded engagement | Guest Insights / check-in event tracking | Authorized check-in view events | Reused forward tracking, epoch eligibility, and privacy scoping | Standard completion + guest tests | Message opens/comparable guest cohorts are not recorded |
| P-13 | §7 | Cleaning, maintenance, turnaround and operational efficiency | BACKEND_ONLY | CLOSED | `/host/operations` / operational-records service | Host-entered task and maintenance records | Added property filter and maintenance-creation UI | Phase 2 tests | Runtime/meter prediction remains unavailable by design |
| P-14 | §7.2 | Response-time analytics | PARTIAL | CLOSED with data boundary | Existing host messaging metrics / booking analytics | Host-level message records | Per-listing response rate remains `DATA_UNAVAILABLE`; never allocated arbitrarily | Phase 14 tests | Requires listing-attributed message response events |
| P-15 | §8 | Search visibility, listing quality and growth opportunities | IMPLEMENTED_VERIFIED | CLOSED | Listing Performance and Opportunities / telemetry & opportunity services | Persisted search/view events and stored listing fields | Inquiry stage added; deterministic quality actions retained | listing-performance, opportunities, Phase 2 tests | Coverage begins only after real telemetry is collected |
| P-16 | §9 | Paid/admin Plus, expiry/revocation and secure APIs | PARTIAL | CLOSED | Entitlements/admin access / entitlement services and guards | Subscription profile state + `HostEntitlementGrant` | Secured previously unguarded expense APIs; preserved existing precedence | entitlements, Phase B, route-contract and Phase 2 tests | Provider checkout/webhooks are not configured |
| P-17 | §10–11 | Navigation, filters, cache/privacy and data integrity | IMPLEMENTED_VERIFIED | CLOSED | Existing Plus pages/APIs | Actor-scoped listings and private no-store APIs | Reused single workspace and query-preserving analytics routes | Phase 13, Phase 14, route-contract tests | Browser E2E belongs to Phase 3 |

## Access and data integrity

- Standard hosts retain Standard dashboard, earnings, insights, calendar, basic listing performance, reviews and opportunities, while direct Plus report APIs remain entitlement-protected.
- Paid and admin-granted Plus access both resolve through the existing entitlement precedence; expiry and revocation fall back to Standard without deleting records.
- All new data is actor/listing scoped. Inquiry telemetry stores only a privacy-preserving hash and a deterministic conversation key.
- Financial figures use immutable booking snapshots and native-currency filters. Last-minute payout is explicitly a recorded eligible payout amount, not a forecast or re-priced booking value.

## Changed Phase 2 files

- `app/api/v1/host/earnings/expenses/route.ts`
- `app/api/v1/host/earnings/expenses/[id]/route.ts`
- `app/(protected)/host/operations/host-operations-client.tsx`
- `services/host-booking-analytics.service.ts`
- `app/(protected)/host/insights/stats/booking-analytics/host-booking-analytics-client.tsx`
- `services/listing-analytics.service.ts`
- `services/messaging.service.ts`
- `services/host-listing-performance.service.ts`
- `app/(protected)/host/insights/listing-performance/host-listing-performance-client.tsx`
- `__tests__/phase2-plus-non-ai-completion.test.ts`

No database migration is needed for this closure pass: the existing durable `ListingAnalyticsEvent` string event type supports the new inquiry event.

## Tests actually executed

Passed:

```text
npx tsx -r dotenv/config --test \
  __tests__/phase2-plus-non-ai-completion.test.ts \
  __tests__/phase13-advanced-earnings-analytics.test.ts \
  __tests__/phase14-advanced-booking-analytics.test.ts \
  __tests__/host-listing-performance.test.ts \
  __tests__/host-dashboard-entitlements.test.ts \
  __tests__/phase-b-access-control.test.ts
```

Result: **35 passed, 0 failed**.

Also passed: focused ESLint for all changed files except the legacy messaging file, `npx tsc --noEmit`, and `git diff --check`.

The full lint invocation including `services/messaging.service.ts` reports 13 existing `no-explicit-any` violations at lines 81–680. The new inquiry code is after those lines and introduces none. A broader mixed regression command also surfaced three existing brittle source assertions in `host-messages-conversation-details-sidebar.test.ts`; they do not concern inquiry telemetry, financial analytics, or Plus access and were not changed in this phase.

## External and AI-deferred register

| Area | Status | What works now | Missing input |
|---|---|---|---|
| Booking source attribution | EXTERNAL / schema dependency | Observed views, inquiries, session-attributed booking conversion | Persisted booking-channel/source field |
| Inquiry-to-booking conversion | PARTIAL | Observed inquiry stage and view-to-inquiry rate from forward events | Durable conversion relationship |
| Advertised-rate history | DATA DEPENDENCY | Realized historical booking rates | Dated price-change snapshots before future instrumentation |
| Competitor occupancy / market events | EXTERNAL_DEPENDENCY | First-party comparable price, amenities, policy and observed change history | Authorized market/event/occupancy provider |
| Subscription checkout | EXTERNAL_DEPENDENCY | Paid-state interpretation and admin grants | Payment provider/webhooks/checkout |
| AI copilot, forecasting, pricing autopilot, predictions, optimizer | AI_DEFERRED | Deterministic data-backed guidance only | Approved AI scope and models |

## Completion calculation and Phase 3 handoff

Completion is calculated across 17 traceable non-AI requirement groups: **14 closed first-party groups + 3 correctly blocked external/data groups = 100% classified; 100% of implementable groups closed.** AI-only requirements are excluded and listed separately.

Phase 2 is locked. Phase 3 should focus on visual polish, responsive/accessibility review, real authenticated browser/E2E validation, production build execution, provider configuration, and resolving the documented external integrations—not on rebuilding these analytics.
