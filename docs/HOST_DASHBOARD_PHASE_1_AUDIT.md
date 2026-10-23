# Host Dashboard Phase 1 audit

Audit date: 2026-10-23 (UTC). This report is based on the implementation and
the financial-policy documents in this repository. The two client `.docx`
files named in the request were not present in the workspace, so their
requirement mapping remains an external-input dependency.

## Scope and status matrix

| Module | Requirement | Existing status | Issue / evidence | File or API | Fix | Final status |
|---|---|---|---|---|---|---|
| Dashboard | Shared host KPI dashboard, property and reporting-period filters | COMPLETE | Dashboard uses the common reporting-period resolver and checks the requested listing against accessible listings. | `services/host-dashboard.service.ts`; `GET /api/v1/host/dashboard` | None required. | COMPLETE |
| Earnings | Net earnings must not include future stays or missing payout snapshots | PARTIAL | Dashboard used a snapshot-presence rule while Earnings used payout-state evaluation. | `services/host-dashboard.service.ts`; `services/payout.service.ts` | Dashboard now calls `calculateBookingPayout` and recognizes only `PAID` or `ELIGIBLE_SETTLEMENT` completed stays. | COMPLETE |
| Earnings | Upcoming payout totals must not be truncated | BROKEN | The overview queried only 60 candidate bookings but exposed the resulting subtotal as a total. | `services/payout.service.ts:getHostEarningsOverview` | Candidate set is complete; UI preview remains sliced after totals are computed. | COMPLETE |
| Earnings | Report the selected settlement currency accurately | BROKEN | `summary.currency` was always `SAR`, including non-SAR reports. | `services/payout.service.ts:getHostEarningsOverview` | Return `chartCurrency`. | COMPLETE |
| Payout communication | Do not promise an automatic bank transfer 24 hours after check-in | BROKEN | Dashboard text stated that payout initiation occurred automatically after check-in. The documented rule is only an eligibility rule; execution is an admin/SARIE action. | `components/host/dashboard/host-kpi-overview.tsx`; `docs/financial/HOST_PAYOUT_WORKFLOWS.md` | UI now calls this a settlement status and distinguishes eligibility, ready-for-admin-settlement, and processing. | COMPLETE |
| Insights statistics | Reuse canonical dashboard KPIs | COMPLETE | Insights delegates to `getHostDashboardData`; metric detail pages use the stats service. | `services/host-insights.service.ts`; `services/host-stats-insights.service.ts`; `GET /api/v1/host/insights*` | None required. | COMPLETE |
| Booking and occupancy | Booked eligible nights / bookable nights; no checkout-day double count | COMPLETE | Shared inventory walks `[check-in, checkout)`, deduplicates listing/date pairs, and lets a confirmed booking override a manual block. | `lib/dashboard/host-inventory.ts`; `services/host-booking-analytics.service.ts` | None required. | COMPLETE |
| Occupancy history | Accurate historical reconstruction | COMPLETE | It is reconstructed from confirmed reservations plus persisted `Listing.blockedDates`; no snapshot data is fabricated. | `lib/dashboard/host-inventory.ts` | None required. | COMPLETE |
| Cancellation | One canonical cohort and denominator across every cancellation surface | PARTIAL | Portfolio KPI is all-time while the “This month snapshot” is booking-creation-month activity. Both are labelled differently, but the detailed metrics need explicit cohort documentation in UI. | `services/host-dashboard.service.ts` | Keep definitions below; add a visible cohort selector/label when the client copy is available. | PARTIAL |
| Reviews | Count published guest-to-property reviews once; category averages use available ratings | COMPLETE | Both dashboard and reviews insight query `PUBLISHED` and `GUEST_TO_PROPERTY`; category denominators are per category. | `services/host-dashboard.service.ts`; `services/host-reviews-insights.service.ts` | None required. | COMPLETE |
| Guest analytics | Unknown origins and unavailable check-in telemetry are honest | COMPLETE | Unknown origin is counted, not inferred. Check-in view data is `DATA_UNAVAILABLE` until the tracking start setting exists. | `services/host-dashboard.service.ts`; `services/host-guest-insights.service.ts` | None required. | COMPLETE |
| Listing performance | Views/conversion and search ranking must have real context | COMPLETE | Telemetry can return unavailable; ranking includes context and observation timestamp. | `services/listing-analytics.service.ts`; `services/host-listing-performance.service.ts` | None required. | COMPLETE |
| Opportunities | Deduplicate recurring listing recommendations and retire resolved items | COMPLETE | Database uniqueness is `(hostId, deduplicationKey)` and lifecycle state is applied to active results. | `prisma/schema.prisma`; `services/host-opportunities.service.ts` | None required. | COMPLETE |
| Access control | Listing filter must be server-side scoped | COMPLETE | Dashboard checks accessible listings; Earnings validates `listingId` against the authenticated host’s listings; detail services perform equivalent ownership checks. | Host dashboard, earnings, insight route/service pairs | None required. | COMPLETE |
| Co-host reporting | Apply accepted co-host permissions consistently to financial reports | PARTIAL | Dashboard listing access supports accepted co-host assignments through `listingService.listForHost`; Earnings and review insight load only `hostId`. | `services/listing.service.ts`; `services/payout.service.ts`; `services/host-reviews-insights.service.ts` | Product decision needed: either extend financial/review access to co-hosts with a financial permission or explicitly restrict co-host dashboards. | PARTIAL |
| Cache invalidation | Refresh immediately after all dependent booking/payment/review changes | PARTIAL | Dashboard uses a safe 20-second in-memory TTL, but invalidation call sites were not verified for every write path. | `services/host-dashboard.service.ts:clearHostDashboardCache` | Wire mutation paths to `clearHostDashboardCache` or use shared Redis tags after mutation audit. | PARTIAL |

## Canonical KPI reference

All money is integer minor units. No aggregate adds different native currencies;
the selected settlement currency is filtered and other currencies are exposed as
separate buckets. There is no FX conversion in host financial reports.

| KPI | Formula / inputs | Reporting date and eligible records | Currency / denominator |
|---|---|---|---|
| Monthly net earnings | Sum `payoutBreakdown.netHostPayout` | Confirmed booking, checkout in selected reporting period, checkout not future, payout state `PAID` or `ELIGIBLE_SETTLEMENT` | One selected settlement currency |
| YTD net earnings | Same as monthly, Jan 1 through now | Checkout date | One selected settlement currency |
| Gross earnings | Accommodation + cleaning + extra guest + pet from immutable payout snapshot | Same recognized completed-stay population | One selected settlement currency |
| Completed/settled payouts | Sum only payout state `PAID` | Payout execution record in the booking financial snapshot | One selected settlement currency |
| Outstanding payouts | Sum payout states `SCHEDULED`, `ELIGIBLE_SETTLEMENT`, or `PROCESSING` | Confirmed bookings with a valid payout snapshot; all historical candidates | One selected settlement currency |
| Occupancy | `bookedNights / bookableNights * 100` | Confirmed reservation nights overlapping selected date interval; nights are `[startDate, endDate)` | `bookable = active listings × days - manual blocks`; booking overrides block |
| Booked / available / blocked nights | Shared date/listing inventory sets | Selected stay-date interval | Counts listing-night pairs once |
| Confirmed bookings | Count confirmed bookings created in selected interval | Booking creation timestamp | Count |
| Average booking value | Recognized net host payout / recognized completed stays | Checkout in selected interval | One selected settlement currency |
| Average stay length | Completed reservation nights / completed stays | Checkout in selected interval | Nights per stay |
| Cancellation rate | Cancelled booking-creation cohort / (confirmed + cancelled booking-creation cohort) | `createdAt`; all-time KPI or explicitly named month snapshot | Count denominator; host rate excludes policy-exempt host cancellations |
| Rating / review count | Average/count of published `GUEST_TO_PROPERTY` reviews | Review creation timestamp | Category averages divide by reviews with that category value |
| Response rate/time | Messaging service response metrics | Selected dashboard reporting interval | Eligible guest inquiries; unavailable is `null` |
| Views and conversion | Analytics event service output | Selected event interval | Conversion uses attributed confirmed bookings / search impressions; unavailable when telemetry is absent |
| Returning guests | Guests with an earlier valid completed stay in the host history | Completed-stay cohort | `returning guests / unique completed-stay guests` |

## Changes made in this phase

- `services/host-dashboard.service.ts`
  - Uses the same `calculateBookingPayout` state engine as Earnings.
  - Adds the payment/refund/quality-incident inputs required for that decision.
  - Separates recognized earnings from actually `PAID` payouts and aligns the
    outstanding-payout scope with Earnings.
- `services/payout.service.ts`
  - Removes the 60-row truncation that could understate outstanding payouts.
  - Reuses the full payout candidate set for paid previews rather than issuing a
    second unbounded query.
  - Returns the selected report currency rather than a hard-coded `SAR`.
- `components/host/dashboard/host-kpi-overview.tsx`
  - Removes the automatic-transfer claim and labels the field as settlement
    status. Eligibility after check-in is not represented as bank arrival.
- `__tests__/host-dashboard-financial-consistency.test.ts`
  - Covers payout-state distinction (`ELIGIBLE_SETTLEMENT` versus `PAID`) and
    checkout-exclusive, block-aware occupancy.

No Prisma schema or migration was needed. Existing user edits in
`components/host/insights/insights-stats-tab.tsx` and
`components/host/insights/insights-tab-nav.tsx` were intentionally untouched.

## Validation

- `pnpm exec tsc --noEmit` — passed.
- `git diff --check` — passed.
- `pnpm exec tsx -r dotenv/config --test __tests__/host-dashboard-financial-consistency.test.ts` — passed (2/2).
- `pnpm build` reached the production build artifact stage (`.next/BUILD_ID` is
  present). The command runner returned streamed output before its final exit
  line, so this is recorded as an observed artifact rather than a claimed clean
  build result.
- Targeted ESLint was run. It reports pre-existing errors in
  `services/payout.service.ts` and `components/host/dashboard/host-kpi-overview.tsx`
  (explicit `any` and React effect rules); the new service changes introduced no
  reported dashboard-service violations. Full lint is therefore not clean.
- No production database, external payout provider, or client `.docx` files
  were available, so the historical numeric examples and live cross-host access
  checks could not be executed.

## Remaining phase checklist

- Phase 2: only the explicit cancellation-cohort labelling decision, if required
  by the missing client documents.
- Phase 3: co-host financial/review permission product decision and an end-to-end
  payment/payout reconciliation run against production-like data.
- Phase 4: mutation-driven cache invalidation verification and timezone policy
  confirmation for property-local reporting (current implementation is UTC).
- Phase 5: enable and verify check-in telemetry after a tracking start date is
  configured; verify real analytics event ingestion.
- Phase 6: no known core deduplication gap; validate live opportunity counts
  against the client examples when supplied.
- Phase 7: deferred Dashboard Plus functionality only; no AI or redesign work
  was added.
- Phase 8: full lint cleanup, production build, authenticated cross-host API
  tests, and reconciliation fixtures for mixed currencies, refunds, and payout
  state transitions.
