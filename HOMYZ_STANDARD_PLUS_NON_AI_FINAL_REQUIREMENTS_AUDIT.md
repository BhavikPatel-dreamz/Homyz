# HOMYZ — Standard + Dashboard Plus (Non-AI) Final Requirements Audit

**Audit date:** 26 October 2026  
**Audit mode:** Repository source, selected automated regression, TypeScript, and production-build audit. No application implementation was changed for this audit.  
**Verdict:** `NOT_PRODUCTION_READY` for the complete client-requested Standard + non-AI Plus scope.

## 1. Executive result

The repository contains a substantial, integrated Host Dashboard rather than a second Plus dashboard. Core Standard dashboard, financial, reviews, listing-access, entitlement, earnings-analytics, booking-analytics, operational-record, and transaction functionality is present and is generally connected to shared services and Prisma records.

That is not sufficient for a production sign-off against the full client scope. The original two DOCX files were not available in the workspace or the accessible `/home/ubuntu` paths, so their text could not be independently read. This report therefore uses the detailed requirements reproduced in the audit brief as a **provisional source map** and does not claim document-complete verification. In addition, two selected regression tests currently fail, live authenticated browser scenarios were not run, and no independent database/API/UI reconciliation could be run against a controlled fixture or production-like database.

There is no P0 defect demonstrated by the evidence collected. There are, however, P1 release requirements: restore a green relevant test baseline, validate the complete source documents, run real data reconciliation and browser/accessibility scenarios, and close the documented data-source gaps (notably conversion attribution and external market/competitor facts). AI capabilities are separately retained as `AI_DEFERRED` and are not counted as complete.

## 2. Source integrity and method

### Original-source availability

| Source | Result | Consequence |
|---|---|---|
| `Host_Dashboard_Specification(8).docx` | Not found in the workspace or accessible `/home/ubuntu` search paths | `SOURCE_VERIFICATION_INCOMPLETE`; no assertion is made that its complete contents were read. |
| `DASHBOARD (Standard Edition)(7).docx` | Not found in the workspace or accessible `/home/ubuntu` search paths | Same limitation. |
| Supplied master audit brief | Read in full from the attachment supplied for this task | Used as the provisional, deduplicated requirement map below. |
| Earlier repository reports | Read as historical evidence, then checked against current source/tests where relevant | They are not treated as proof of current runtime behavior. |

`A` and `B` in the matrix mean the requirement is attributed to the respectively named original document **as described by the supplied brief**. They do not prove that the DOCX wording was inspected. `A+B*` means the brief says the requirement is present or overlapping across the two documents.

### Evidence performed

| Check | Result | Evidence |
|---|---|---|
| TypeScript | `PASS` | `npx tsc --noEmit --pretty false` completed successfully. |
| Production build | `PASS` | `npm run build` completed and produced a fresh `.next/BUILD_ID` on 26 Oct 2026. |
| Selected regression suite | `75 / 77 PASS`; `2 FAIL` | `tsx --test` run across dashboard, financial consistency, calendar spans, insights, advanced earnings, booking analytics, listing performance, entitlements, access-control, and transaction suites. |
| Full ESLint | `NOT_RUN` | The audit did not represent a full-lint result as passed; existing reports identify legacy lint debt. |
| Database fixture reconciliation | `NOT_RUN` | No controlled database fixture / independent SQL evidence was supplied or exercised. |
| Authenticated browser, responsive, keyboard and screen-reader checks | `NOT_RUN` | No browser automation or representative credentials/test tenants were available in this audit. |
| External payout, PayPal, banking, competitor, market-event, and search provider checks | `NOT_RUN` | Requires configured provider credentials/data and controlled integration scenarios. |

The two failed selected tests are source-contract drift, but they still prevent a green release regression baseline:

1. `__tests__/phase-b-access-control.test.ts`, payout-method scenarios 10–11, expects the retired JSON `personalInfo.payoutMethods` implementation. Current `services/payout.service.ts` uses relational payout methods and includes PayPal support.
2. `__tests__/phase8-host-insights-reviews.test.ts:87` expects `href="/host/insights?tab=reviews"`; the current review-details client has changed navigation shape. The test must be reconciled with the intended route and then rerun.

## 3. Architecture and audit observations

- **Single product surface:** `/host/dashboard` is the summary, `/host/earnings` owns financial management, `/host/insights` owns reviews/stats/opportunities/Superhost, and feature detail pages extend those surfaces. No parallel Dashboard Plus application was found.
- **Shared authoritative services:** dashboard and insights call shared dashboard data (`services/host-dashboard.service.ts` and `services/host-insights.service.ts`); financial transactions are served by `services/payout.service.ts`; advanced revenue and bookings use `services/host-earnings-analytics.service.ts` and `services/host-booking-analytics.service.ts`.
- **Access boundary:** `accessibleHostListingWhere` is used by the dashboard/insights/analytics/operations services examined. Route/API gates use `getHostDashboardEntitlements` or `requireHostDashboardFeature` for Plus functionality.
- **Financial semantics:** current code distinguishes `all`, `upcoming`, and `paid` transactions (`HostEarningsTransactionKind`) and uses payout snapshots. A completed bank transfer must still be verified from settlement state, not inferred from eligible earnings.
- **Data provenance limit:** code paths and tests provide strong structural evidence; they do not independently prove that a particular tenant’s stored values, provider data, reports, or displayed charts reconcile in production.

## 4. Requirement coverage matrix

Status meaning: `VERIFIED_COMPLETE` has current source plus relevant executed automated evidence; `PARTIAL` has useful implementation but a material requirement/data/verification gap; `UNVERIFIED` has source presence without runtime proof; `EXTERNAL_BLOCKED` depends on a provider or unavailable source; `AI_DEFERRED` is intentionally out of implementation scope. “Correct” in UI/Data/Access means source and selected tests support it, not that a live browser/production database test was run.

### A. Standard Dashboard — non-AI

| ID | Doc / section | Tier | Requirement and expected behavior | Route / frontend | Backend / database | Status | UI / Data / Access | Actual test evidence | Gap and action | Pri. / closure |
|---|---|---|---|---|---|---|---|---|---|---|
| S01 | A+B* / Overview | Standard | Monthly earnings, YTD, prior-period trend; concise operational overview | `/host/dashboard`; `host-kpi-overview` | `getHostDashboardData`; payout/booking records | VERIFIED_COMPLETE | Correct / Correct by fixture / Authorized | dashboard + financial consistency tests | Live reconciliation still required | P1 / Open |
| S02 | A+B* / Overview | Standard | Upcoming amount, estimated arrival and payout method | dashboard KPI/cards | dashboard + payout service; payout methods | PARTIAL | Correct / Unverified live settlement / Authorized | dashboard source/regression | Arrival is not proof of completed bank transfer; verify settlement rail | P1 / Open |
| S03 | A+B* / Overview | Standard | Occupancy, booked, available and blocked nights | dashboard inventory cards | shared host inventory / bookings / blocks | VERIFIED_COMPLETE | Correct / Correct by fixtures / Authorized | `host-calendar-reservation-spans`, financial consistency | Reconcile live inventory boundaries | P1 / Open |
| S04 | A+B* / Overview | Standard | Average booking value, stay length, cancellation count/rate/trend | dashboard KPIs | dashboard service / booking facts | VERIFIED_COMPLETE | Correct / Correct by fixtures / Authorized | dashboard regression | Production period sample required | P1 / Open |
| S05 | A+B* / Overview | Standard | Next reservation, performance summary and priority hosting actions | dashboard cards | dashboard/opportunities services | VERIFIED_COMPLETE | Correct / Correct by fixtures / Authorized | dashboard/opportunities tests | Browser link traversal not run | P1 / Open |
| S06 | A+B* / Reservations | Standard | Upcoming/past reservations with guest, dates, nights, rate, amount, status | dashboard/calendar/reservation components | booking records and listing access filter | VERIFIED_COMPLETE | Correct / Correct by fixture / Authorized | calendar span + dashboard tests | Browser flow still required | P1 / Open |
| S07 | A+B* / Reservations | Standard | Booked, available, owner-blocked and maintenance/prep calendar treatment; checkout excluded | host calendar | shared inventory and booking spans | VERIFIED_COMPLETE | Correct / Correct by fixture / Authorized | `host-calendar-reservation-spans.test.ts` | Validate multi-listing tenant data | P1 / Open |
| S08 | A+B* / Reservations | Standard | Booking-source indicators and dynamic-price overlays where enabled | calendar/reservation UI | booking source / pricing observations | PARTIAL | Partial / Unverified / Authorized | source inspection | Source normalization and overlay data availability are not independently proven | P1 / Open |
| S09 | A+B* / Reservations | Standard | Monthly booking count, cancellation %, average stay and calendar-to-reservation navigation | dashboard + calendar | dashboard service | VERIFIED_COMPLETE | Correct / Correct by fixtures / Authorized | dashboard/calendar tests | Direct browser links not run | P1 / Open |
| S10 | A+B* / Guest information | Standard | Country/city origins, top city by country and six-month breakdown | Insights Stats | `host-guest-insights.service` / booking guest fields | VERIFIED_COMPLETE | Correct / Correct by fixtures / Authorized | stats/guest tests | Need representative populated tenant check | P1 / Open |
| S11 | A+B* / Guest information | Standard | Guest-origin map without fabricated geography | Insights Stats | aggregated origin data | UNVERIFIED | Unverified / Unverified / Authorized | source inspected; no browser map/data test | Validate map component, empty state and geocoding source | P1 / Open |
| S12 | A+B* / Guest information | Standard | Returning guests, repeat identification and guest rating | Insights / guest metrics | guest insights/dashboard services | VERIFIED_COMPLETE | Correct / Correct by fixtures / Authorized | guest/stat tests | Live sample required | P1 / Open |
| S13 | A+B* / Guest information | Standard | Viewed/not-viewed check-in instructions and quality indicators; no false zero before tracking | insights stats | tracking cutoff via `CHECKIN_INSTRUCTIONS_TRACKING_STARTED_AT` | PARTIAL | Partial / Unverified historical coverage / Authorized | source inspection + stats tests | Configure/verify tracking start date and historical unavailable state | P1 / Open |
| S14 | A+B* / Reviews | Standard | Overall count/rating and cleanliness, accuracy, check-in, communication, location, value | `/host/insights` reviews/detail | `host-reviews-insights.service` / reviews | VERIFIED_COMPLETE | Correct / Correct by fixture / Authorized | review tests (one nav assertion stale) | Restore green test contract | P1 / Open |
| S15 | A+B* / Reviews | Standard | Recent reviews, distribution and 12-month review/rating trend | Insights Reviews | reviews service aggregation | VERIFIED_COMPLETE | Correct / Correct by fixture / Authorized | reviews tests | Runtime chart validation required | P1 / Open |
| S16 | A+B* / Reviews | Standard | Reply, unanswered alert and basic evidence-based improvement guidance | review detail/opportunities | review APIs and opportunities service | PARTIAL | Partial / Correct by fixture / Authorized | review/opportunity tests | Current suite has stale review-detail navigation assertion; test interaction in browser | P1 / Open |
| S17 | A+B* / Financial snapshot | Standard | Monthly graph, monthly/YTD earnings, nightly and cleaning-fee treatment, service fees | `/host/earnings` | payout/reporting services, payout snapshots | VERIFIED_COMPLETE | Correct / Correct by fixtures / Authorized | financial consistency + transaction tests | Independent database/UI reconciliation required | P1 / Open |
| S18 | A+B* / Financial snapshot | Standard | Pending/upcoming/paid payouts, refunds, adjustments, reports and history | earnings, transactions, upcoming, reports | `payout.service`, transaction APIs | VERIFIED_COMPLETE | Correct / Correct by fixtures / Authorized | transaction final/detail tests | Verify real provider settlement state | P1 / Open |
| S19 | A+B* / Financial snapshot | Standard | Financial detail navigation uses authorized real financial records | earnings transactions/detail | transaction API and listing scope | VERIFIED_COMPLETE | Correct / Correct by fixtures / Authorized | access-control + transaction tests | Restore stale payout test assertions | P1 / Open |
| S20 | A+B* / Listing performance | Standard | Views, conversion, ranking, comparable average price and listing reporting without invented observations | `/host/insights/listing-performance` | `host-listing-performance.service` / observations | PARTIAL | Correct / Unverified data provenance / Authorized | listing-performance tests | Verify source coverage/timestamps; do not show absent observations as facts | P1 / Open |
| S21 | A+B* / Health & Superhost | Standard | Response performance, photos, description/amenities, quality signals and listing health | insights/stats | stats/dashboard services / listing records | VERIFIED_COMPLETE | Correct / Correct by fixtures / Authorized | stats tests | Browser responsive audit required | P1 / Open |
| S22 | A+B* / Health & Superhost | Standard | Host-level Superhost status, thresholds, evaluation periods and actions; no listing badge confusion | `/host/insights/superhost` | Superhost service / booking-response facts | VERIFIED_COMPLETE | Correct / Correct by fixtures / Authorized | `phase12-host-insights-superhost` | Confirm real evaluation policy values | P1 / Open |
| S23 | A+B* / Opportunities | Standard | Photo/description/amenity/review/occupancy/cancellation/Superhost actions with evidence, priority, property, resolution and working links | insights opportunities | `host-opportunities.service` | VERIFIED_COMPLETE | Correct / Correct by fixtures / Authorized | opportunities tests | Browser link/resolution test required | P1 / Open |
| S24 | A+B* / Standard access & UX | Standard | Standard availability, direct navigation, loading/empty/error/responsive/accessibility quality | dashboard/earnings/insights shell | roles, listing scope and page routes | UNVERIFIED | Unverified / Unverified / Partially tested | page/source tests only | Execute authenticated desktop/mobile/keyboard/axe suite | P1 / Open |

### B. Dashboard Plus — non-AI

| ID | Doc / section | Tier | Requirement and expected behavior | Route / frontend | Backend / database | Status | UI / Data / Access | Actual test evidence | Gap and action | Pri. / closure |
|---|---|---|---|---|---|---|---|---|---|---|
| P01 | A+B* / Advanced earnings | Plus | RevPAN, property/portfolio RevPAN and history from real available-night inventory | `/host/earnings/analytics`, `/revpan` | earnings analytics / bookings, blocks, payout snapshots | VERIFIED_COMPLETE | Correct / Correct by fixtures / Feature-gated | advanced earnings tests; RevPAN page gate | Independently reconcile a populated tenant; docs unavailable | P1 / Open |
| P02 | A+B* / Advanced earnings | Plus | Gross revenue, net realized earnings and seasonal historical comparisons | analytics | `host-earnings-analytics.service` | VERIFIED_COMPLETE | Correct / Correct by fixtures / Feature-gated | advanced earnings tests | Browser chart/filter test required | P1 / Open |
| P03 | A+B* / Advanced earnings | Plus | Revenue by booking source | analytics | booking source attribution | PARTIAL | Partial / Unverified attribution / Feature-gated | source/tests | Normalize source provenance and validate no unknown-source distortion | P1 / Open |
| P04 | A+B* / Advanced earnings | Plus | Itemized accommodation, cleaning, platform fees, taxes, refunds and adjustments | analytics/transactions | immutable payout snapshot and payout service | VERIFIED_COMPLETE | Correct / Correct by fixtures / Feature-gated | financial/transaction tests | Live accounting reconciliation required | P1 / Open |
| P05 | A+B* / Advanced earnings | Plus | Recorded expenses, estimated profit, margin, cost/stay and profit/booking | earnings expenses / operations | `OperatingExpense`, operational/earnings services | VERIFIED_COMPLETE | Correct / Correct by fixtures / Feature-gated | phase 2/3 Plus tests | Validate currency and voided expense scenarios in DB | P1 / Open |
| P06 | A+B* / Advanced earnings | Plus | Property financial comparisons and period-comparison controls actually update values | advanced earnings | analytics service/filter state | VERIFIED_COMPLETE | Correct / Correct by fixtures / Feature-gated | advanced earnings/comparison tests | Browser interaction and custom/prior-year periods still require release QA | P1 / Open |
| P07 | A+B* / Reservation analytics | Plus | Lead time, windows and last-minute rate | `/host/insights/stats/booking-analytics` | `host-booking-analytics.service` | VERIFIED_COMPLETE | Correct / Correct by fixtures / Feature-gated | phase14 booking analytics tests | Live multi-property/reported timezone check | P1 / Open |
| P08 | A+B* / Reservation analytics | Plus | Booking day/hour and length-of-stay heatmaps; revenue by duration | booking analytics | booking timestamps and revenue data | VERIFIED_COMPLETE | Correct / Correct by fixtures / Feature-gated | phase14 tests | Browser rendering and sparse-data empty state required | P1 / Open |
| P09 | A+B* / Reservation analytics | Plus | Historical occupancy and property comparisons | booking/occupancy analytics | booking + inventory facts | PARTIAL | Partial / Unverified historical completeness / Feature-gated | booking analytics tests | Reconcile historical blocks and calendar timezone | P1 / Open |
| P10 | A+B* / Reservation analytics | Plus | Attributed views → inquiries → bookings conversion funnel | booking analytics | analytics events/inquiries/bookings | PARTIAL | Partial / Unverified causal attribution / Feature-gated | existing Plus tests explicitly note unavailable inquiry-to-booking relation | Build/verify durable attribution before claiming a funnel | P1 / Open |
| P11 | A+B* / Reservation analytics | Plus | Historical nightly price: set price vs conversion-time booked price | pricing/analytics surfaces | pricing observations and booking data | PARTIAL | Partial / Unverified / Feature-gated | source inspection | Record both values with a common listing/date identity | P1 / Open |
| P12 | A+B* / Revenue & occupancy | Plus | Observed high/low demand, seasonality and historical revenue/occupancy; no forecast claim | earnings/insights analytics | recorded bookings/inventory | VERIFIED_COMPLETE | Correct / Correct by fixtures / Feature-gated | analytics tests | Label observations and missing history consistently | P1 / Open |
| P13 | A+B* / Pricing non-AI | Plus | Dynamic pricing/change observations and lead-time/occupancy-gap/minimum-stay alerts with inputs | pricing/insights | observations + opportunities | PARTIAL | Partial / Unverified input coverage / Feature-gated | source inspection/opportunities tests | Verify pricing observation ingestion and explanation per alert | P1 / Open |
| P14 | A+B* / Pricing non-AI | Plus | Rule-based rate suggestions and supported pricing alerts | advanced analytics/opportunities | observation-backed rules | VERIFIED_COMPLETE | Correct / Correct by fixtures / Feature-gated | Plus/opportunity tests | Validate tenant-level displayed evidence | P1 / Open |
| P15 | A+B* / Competitors | Plus | Comparable selection, price/night, amenities, response time and cancellation policy | listing performance/competitor views | comparable observations | PARTIAL | Partial / Unverified comparator completeness / Feature-gated | listing-performance tests | Need supplier/source, timestamp and selection explanation | P1 / Open |
| P16 | A+B* / Competitors | Plus | Competitor occupancy, price changes, new-listing alerts and historical observations | competitor surfaces | external competitor feed/observation history | EXTERNAL_BLOCKED | Unavailable / Unverified / Feature-gated | no external integration test | Integrate licensed data source or explicitly suppress unsupported metrics | P1 / Blocked |
| P17 | A+B* / Market intelligence | Plus | Observed demand, holidays, booking pace, search trends and comparable-market facts where tracked | market/analytics surfaces | booking and external market facts | PARTIAL | Partial / Unverified / Feature-gated | source inspection | Verify which non-external signals are truly recorded and label unavailable inputs | P1 / Open |
| P18 | A+B* / Market intelligence | Plus | Local events and externally sourced market observations with timestamps | market/pricing | external event/market provider | EXTERNAL_BLOCKED | Unavailable / Unverified / Feature-gated | no provider test | Add provider/data contract or omit event-driven recommendation | P1 / Blocked |
| P19 | A+B* / Guest intelligence | Plus | Country/city, trip purpose, business/leisure/family patterns and booking behavior | Insights Stats/booking analytics | guest + booking facts | PARTIAL | Partial / Unverified classification provenance / Feature-gated | guest/stats/booking tests | Ensure purpose categories are actual captured data, not inference | P1 / Open |
| P20 | A+B* / Guest intelligence | Plus | Returning frequency, lifetime value and returning-guest revenue | guest/earnings analytics | guest identity + financial facts | PARTIAL | Partial / Unverified identity merge / Feature-gated | source and analytics tests | Validate identity dedupe and cross-listing/currency behavior | P1 / Open |
| P21 | A+B* / Guest intelligence | Plus | Pre-arrival engagement, message opens and check-in views where tracked | insights stats | tracking records/env cutoff | PARTIAL | Partial / Unverified coverage / Feature-gated | stats source/tests | Present historical unavailability, not false zero | P1 / Open |
| P22 | A+B* / Operations | Plus | Cleaning tasks/completion/turnaround/costs and maintenance history/expense | `/host/operations` | `CleaningTask`, `MaintenanceRecord`, `OperatingExpense` | VERIFIED_COMPLETE | Correct / Correct by fixtures / Feature-gated | Plus/operations tests | Run operational workflow in browser | P1 / Open |
| P23 | A+B* / Operations | Plus | Response trends, operational costs, cost/stay, revenue/booking, profit/booking and property operating performance | operations/earnings analytics | operational + earnings services | VERIFIED_COMPLETE | Correct / Correct by fixtures / Feature-gated | Plus/advanced analytics tests | Independent financial data reconciliation required | P1 / Open |
| P24 | A+B* / Marketing growth | Plus | Impressions, views, CTR where measurable, ranking history, conversion and search-performance trends | listing performance/insights | `ListingAnalyticsEvent` / observations | PARTIAL | Partial / Unverified instrumentation completeness / Feature-gated | listing-performance tests | Demonstrate event capture, dedupe and denominator definitions | P1 / Open |
| P25 | A+B* / Marketing growth | Plus | Title/description/photo/amenity rule checks, evidence-based recommendations and improvement tracking | listing health/opportunities | listing data + opportunities | VERIFIED_COMPLETE | Correct / Correct by fixtures / Feature-gated | opportunities/stats tests | Browser action-link verification | P1 / Open |
| P26 | A+B* / Entitlements | Plus | Paid Plus, complimentary admin grant, expiry, revocation and suspension | protected pages/upgrade states | `HostEntitlementGrant`, entitlement service | VERIFIED_COMPLETE | Correct / Correct by tests / Authorized | entitlement + access-control tests | Admin grant is Homyz-specific; source docs not available to map it precisely | P1 / Open |
| P27 | A+B* / Entitlements | Plus | Direct URL/API gates for advanced earnings, booking behavior, RevPAN and operations | protected routes and APIs | `requireHostDashboardFeature` | VERIFIED_COMPLETE | Correct / Correct by tests / Authorized | entitlement/access-control tests | Restore stale payout access test baseline | P1 / Open |
| P28 | A+B* / Entitlements | Plus | Co-host financial restrictions and host data isolation | financial detail/analytics routes | `accessibleHostListingWhere`, permissions | PARTIAL | Unverified browser / Unverified DB adversarial test / Partially tested | source inspection/access tests | Run explicit accepted/revoked co-host and cross-host API tests; granular finance delegation remains insufficiently demonstrated | P1 / Open |

### C. Explicit AI register — intentionally excluded from implementation coverage

| ID | Doc / section | Tier | AI requirement | Status | Existing non-AI adjacent behavior | Final action / closure |
|---|---|---|---|---|---|---|
| AI01 | A / AI Host Insights | AI Deferred | AI Host Copilot | AI_DEFERRED | Rule-based opportunities may exist | Do not represent as copilot / Deferred |
| AI02 | A / AI Host Copilot | AI Deferred | AI guest message drafting | AI_DEFERRED | Manual review reply exists | Deferred |
| AI03 | A+B* / Listing | AI Deferred | AI listing optimizer | AI_DEFERRED | Rule-based completeness checks exist | Deferred |
| AI04 | A+B* / Pricing | AI Deferred | AI pricing autopilot | AI_DEFERRED | Observation/rule-based suggestions only | Deferred |
| AI05 | A / Earnings | AI Deferred | AI revenue forecasting | AI_DEFERRED | Historical reporting only | Deferred |
| AI06 | A / Market | AI Deferred | Predictive seasonal revenue forecasts | AI_DEFERRED | Historical seasonality only | Deferred |
| AI07 | A / Market | AI Deferred | Predictive 90-day demand calendar | AI_DEFERRED | Observed demand only where sourced | Deferred |
| AI08 | A+B* / Reviews | AI Deferred | AI review sentiment analysis | AI_DEFERRED | Review ratings/replies and rule alerts | Deferred |
| AI09 | A / Guest | AI Deferred | Guest churn prediction | AI_DEFERRED | Returning-guest reporting only | Deferred |
| AI10 | A / Guest | AI Deferred | Predictive pre-arrival engagement score | AI_DEFERRED | Recorded view/open status only where tracked | Deferred |
| AI11 | B / Host score | AI Deferred | AI Host Score | AI_DEFERRED | Rule-based health/Superhost information | Deferred |
| AI12 | A / Insights | AI Deferred | AI personalized impact prediction | AI_DEFERRED | Static priority/action logic only | Deferred |
| AI13 | A+B* / Operations | AI Deferred | Predictive maintenance | AI_DEFERRED | Recorded maintenance history/tasks | Deferred |
| AI14 | B / Marketing | AI Deferred | Predicted marketing ROI | AI_DEFERRED | Observed marketing metrics only | Deferred |
| AI15 | A+B* / Marketing | AI Deferred | AI title/description grading | AI_DEFERRED | Supported completeness rules only | Deferred |
| AI16 | A / Reports | AI Deferred | AI monthly host reports | AI_DEFERRED | Standard exports/reports only | Deferred |
| AI17 | A / Coaching | AI Deferred | AI goal-based coaching | AI_DEFERRED | Rule-based opportunities only | Deferred |
| AI18 | A+B* / Pricing | AI Deferred | Predictive pricing elasticity | AI_DEFERRED | Historical/rule-based price signals only | Deferred |

## 5. Data accuracy and reconciliation result

### Financial and inventory definitions

| Area | Source-level conclusion | Independent verification result |
|---|---|---|
| Earnings and payout status | Snapshot-based payout/transaction paths distinguish upcoming from paid. | `UNVERIFIED`: no independent database/API/UI tenant comparison executed. |
| Refunds, adjustments and fees | Dedicated transaction/itemization paths are present. | `UNVERIFIED`: no seeded or production ledger was reconciled. |
| Occupancy | Shared inventory logic and calendar-span tests support booked-night and checkout-exclusive treatment. | `VERIFIED_BY_TEST_FIXTURE`, not verified against a live tenant. |
| RevPAN | Advanced earnings code and tests calculate it from revenue and available inventory. | `VERIFIED_BY_TEST_FIXTURE`; the cited historical example (SAR 9,496 / 32 / 2,124) was not hardcoded or revalidated without its source data. |
| Reporting periods | Current filters and comparison UI are present. | `PARTIAL`: month-to-date, full-month, custom, timezone and recognition-basis behavior require an independent scenario matrix. |
| Cross-page reconciliation | Shared dashboard service reduces definition drift between Dashboard and Insights. | `PARTIAL`: Earnings has purposefully distinct realized/payout concepts; no matched-scope database/API/UI audit was run. |

No data row above is promoted from “fixture/source supported” to “production accurate” without the independent check requested by the brief.

## 6. Functional, navigation, security and production audit

### Working evidence

- Dashboard, financial, calendar span, insights, reviews, stats, opportunities, Superhost, advanced earnings, booking analytics, listing performance, entitlement, access-control and transaction test suites were selected and executed.
- Source gates exist for `ADVANCED_EARNINGS`, `BOOKING_BEHAVIOR`, `REVPAN`, and `OPERATIONS_AND_PROFITABILITY`; operations endpoints are marked `Cache-Control: private, no-store`.
- Services examined consistently apply `accessibleHostListingWhere`, reducing cross-listing/cross-host query exposure.
- Pagination/filter support is implemented in the transaction route/client; pages/build typecheck currently compile.

### Not established by this audit

- Every direct link/back button, skeleton, empty/error state, responsive breakpoint, modal stacking, keyboard path, screen-reader label, chart tooltip, and pagination state in a real browser.
- Response-time, query-plan, N+1, cache effectiveness, large-portfolio performance, and rendering behavior with hundreds of properties.
- New Standard host, paid Plus, admin-granted Plus, expired/revoked Plus, suspended host, limited co-host, multiple currencies, refunds, and no-history scenarios under authenticated end-to-end execution.
- Live banking/PayPal provider success/failure/webhook/reconciliation paths. PayPal implementation source exists, but credentials and provider behavior were not tested.

## 7. Completion percentages

### Counting rule

The non-AI matrix has **52 deduplicated behavior rows**: 24 Standard and 28 Plus. Only `VERIFIED_COMPLETE` is counted as feature-complete. `PARTIAL`, `UNVERIFIED`, and `EXTERNAL_BLOCKED` count as zero. This is deliberately conservative and is **not code-coverage**. “Verified functional” has the same numerator here because the audit will not call source-only functionality proven when it lacks a passing applicable automated test or an equivalent fixture check.

| Measure | Complete / total | Result |
|---|---:|---:|
| Standard non-AI feature implementation | 17 / 24 | **70.8%** |
| Standard verified functional coverage | 17 / 24 | **70.8%** |
| Plus non-AI feature implementation | 14 / 28 | **50.0%** |
| Plus verified functional coverage | 14 / 28 | **50.0%** |
| Combined non-AI implementation | 31 / 52 | **59.6%** |
| Combined non-AI verified functional coverage | 31 / 52 | **59.6%** |
| Executed selected test-case pass rate | 75 / 77 | **97.4%** |
| AI requirements intentionally deferred | 18 / 18 | **100.0% deferred; 0 counted as implemented** |

The much higher test-case pass rate is not a contradictory product-completion percentage: tests cover some completed behavior deeply, while a number of client requirements remain external-data, provenance, UX, or live-reconciliation gaps.

## 8. One deduplicated pending-work list

This is intentionally grouped by existing module, not by a new phase plan.

### Dashboard

- Run authenticated browser checks for Standard overview, cards, filters, empty/error/loading states, all navigation, responsive layout and accessibility.
- Reconcile a controlled tenant’s dashboard KPI values independently against database queries and API output.
- Confirm source normalization for booking-source cards and dynamic-price overlays.

### Earnings and Transactions/Payouts

- Repair the two stale test contracts and restore a green selected regression suite; preserve the relational payout-method contract rather than reverting it for an old test.
- Reconcile monthly/YTD/realized/eligible/upcoming/paid/refund/adjustment values using an independent fixture, API response and rendered UI capture.
- Execute payout settlement, failure/hold, PayPal and banking webhook scenarios with sandbox credentials; never label eligibility as a disbursed transfer.
- Complete the reporting-period scenario matrix: current month, month-to-date, full month, prior period, prior year, custom date range, timezone and accounting-recognition basis.

### Insights, Reviews, Stats, Opportunities and Superhost

- Align the review-details back-link contract and test, then verify reply/resolution flows in a browser.
- Test map rendering/geography, historical-tracking unavailable state, ranking/observation timestamps and sparse-data UX with representative tenant data.
- Verify each opportunity’s evidence, listing identity, priority, action link and resolved state end to end.

### Plus Advanced Earnings and Booking Analytics

- Demonstrate that period/property comparison controls update chart/KPI values in the browser.
- Complete durable, auditable view → inquiry → booking attribution before representing a conversion funnel as complete.
- Store/verify both set-price and booked-price identities and reconcile historical occupancy with blocks/timezone.

### Plus Pricing, Competitors and Market

- Define and validate pricing-observation ingestion, alert input evidence and historical price-change provenance.
- Obtain a licensed, timestamped competitor/event/market source or explicitly hide unsupported occupancy, historical competitor, new-listing and event claims. These are external dependencies, not data to fabricate.

### Plus Guest, Operations and Marketing

- Validate trip-purpose taxonomy, guest identity deduplication, returning-guest LTV/revenue and message/open tracking coverage.
- Run cleaning/maintenance/expense lifecycle browser tests, including voided-cost and multi-currency scenarios.
- Verify analytics-event instrumentation, deduplication and denominators before claiming impressions, CTR, ranking or conversion data.

### Permissions and data isolation

- Execute adversarial API/browser scenarios for Standard, paid Plus, admin grant, expiry, revocation, suspension, accepted/revoked co-host and cross-host access.
- Make granular co-host financial permission behavior explicit and test it; current listing-scope evidence does not fully prove the documented restricted-finance scenario.

### Production UI/UX and operations

- Run full lint and record/remediate actual findings separately from pre-existing debt.
- Run performance/query-plan and large-portfolio load tests; assess caching/lazy loading and render cost.
- Run keyboard, screen-reader and responsive tests; retain the existing navigation model rather than creating another dashboard.
- Supply both original DOCX files (or controlled text exports) and repeat only the source-mapping portion to close `SOURCE_VERIFICATION_INCOMPLETE`.

## 9. Release blockers and final decision

| Priority | Finding | Release consequence |
|---|---|---|
| P1 | Original client DOCX documents are inaccessible | Full requirement traceability cannot be signed off. |
| P1 | Selected regression suite has 2 failures | A release baseline cannot be reported green. |
| P1 | No independent database/API/UI financial and analytics reconciliation | Actual displayed financial/occupancy correctness remains unproven. |
| P1 | Conversion funnel attribution and several pricing/competitor/market inputs are incomplete or external | Do not ship/market these documented capabilities as complete. |
| P1 | Required authenticated E2E, accessibility, responsive and co-host restriction scenarios were not executed | Security and UX assertions are incomplete. |
| P2 | Full-lint, load/query-plan and live provider checks were not executed in this audit | Required before a broader production sign-off, after P1 closure. |

**Final verdict: `NOT_PRODUCTION_READY` for the complete Standard + non-AI Dashboard Plus requirement set.** The core product has meaningful implementation and passed TypeScript/build plus 75 of 77 selected tests. It may be suitable for a constrained internal/staging validation after the listed P1 evidence gaps are addressed, but it must not be represented as fully compliant with both original client documents or as a completed non-AI Plus release.
