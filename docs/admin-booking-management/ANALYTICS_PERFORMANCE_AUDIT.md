# Admin Booking & Financial Analytics Audit

## Scope and definitions

The Admin dashboard now uses a UTC reporting boundary, matching the existing Admin booking screens.

- **Booking KPIs and trends** are a `Booking.createdAt` cohort. A completed stay is a confirmed booking whose `endDate` is before the current time. This makes Confirmed, Completed, Pending, and Cancelled mutually exclusive.
- **Cancellation rate** is cancelled bookings divided by all bookings in the same created-at cohort.
- **Financial KPIs** are transaction-period metrics: captured payment records minus successfully completed refund records. Booking prices are never used as collected money.
- **Active disputes opened in period** means `PENDING` or `CONFIRMED` incidents created during the selected period. Resolved and rejected incidents remain available in reports but are not counted as active.

## Root causes found

1. The trends response only emitted days with activity, and the chart plotted only `newBookings` even though its legend advertised confirmed and cancelled values. A cohort with no new bookings appeared blank despite lifecycle activity.
2. `BookingPayment` and `BookingRefund` contain no rows in the configured development database. The displayed SAR 0 financial values are therefore accurate for that database. The implementation additionally used payment `amount` and embedded refunded values instead of the verified `capturedAmount` and successful refund ledger; this is corrected for future transaction records.
3. Property Performance called nested `Listing → Booking → Refund` reads, and Host Performance nested `User → Listing → Booking → Refund` reads. Both pulled every related booking for each paginated parent and the page blocked initial rendering on both tables.
4. The client had page/search state for both tables but never issued table requests or rendered pagination controls; search was only a local filter on the already-loaded first page.
5. Property values based on `Booking.totalPrice` were labeled "Gross Captured", conflating booked value with payment-provider settlement. Host payout figures also applied a 3% fallback estimate where no immutable payout snapshot existed.
6. The Reports UI exposed eight report types while the service implemented only four; the remaining choices returned an unsupported-report error.

## Accuracy report — development database, Last 30 Days

| Metric | Result | Source of truth |
| --- | ---: | --- |
| Total Bookings | 47 | `Booking.createdAt` cohort |
| Confirmed | 8 | Confirmed bookings with future/current end dates |
| Completed Stays | 34 | Confirmed bookings with elapsed end dates |
| Pending | 2 | Pending booking records |
| Cancellations | 3 | Cancelled booking records |
| Cancellation Rate | 6.4% | 3 ÷ 47 created-at cohort |
| Gross Captured | No verified transactions / 0 | `BookingPayment.capturedAmount` in captured/refunded lifecycle statuses |
| Successful Refunds | No verified transactions / 0 | `BookingRefund` with `SUCCEEDED` status |
| Net Collected | No verified transactions / 0 | Captured minus successful refund transactions per currency |
| Active disputes opened in period | Derived from `PENDING` + `CONFIRMED` cases | `ListingQualityIncident` |

The database contains 47 bookings, 0 payment transactions, and 0 refund transactions. Zero financial figures are shown as data absence, not replaced with booking values.

## Implementation details

### Server and API

- `services/analytics-admin.service.ts`
  - Runs the overview’s booking cohort, payments, refunds, and disputes queries concurrently.
  - Adds every UTC calendar day to the trend response, including zero-activity dates.
  - Uses `capturedAmount` from captured/partially-refunded/refunded payment records and only `SUCCEEDED` refunds.
  - Preserves currency boundaries in all financial totals; values are never summed across currencies.
  - Applies listing/Host/city/country scope consistently to overview financial and dispute queries.
  - Replaces nested performance-table reads with paginated parent selection and batched booking/payment/refund queries.
  - Defaults property performance to active listings with in-period activity. Operators can include inactive and zero-activity listings.
  - Removes estimated Host-payout fallback. Only saved payout snapshots are reported, explicitly without a settlement claim.
  - Implements the four previously advertised report types: payout snapshot, dispute, property, and Host.
- `app/api/v1/admin/bookings/analytics/{overview,properties,hosts}/route.ts`
  - Accepts server-side period and relevant property filters.
- `app/(protected)/admin/bookings/analytics/page.tsx`
  - Renders the overview first; tables no longer block initial useful content.

### Dashboard UX

- `app/(protected)/admin/bookings/analytics/admin-analytics-client.tsx`
  - Displays a four-series stacked cohort chart with matching legend, tooltip values, and a meaningful zero-data state.
  - Fetches property and Host tables independently, with loading/error states, debounced server-side search, request abortion on stale selection, and pagination.
  - Uses accurate table labels: booked value, gross captured, successful refunds, and net financial volume.
  - Provides an active/inactive and zero-activity operational view for properties.
  - Refresh reloads the overview and both independent table datasets without a browser reload.

## Performance measurements

Measured directly through the service against the configured development database (47 bookings, 195 listings, 27 Hosts). Timings include the development database/adapter overhead and are not production SLOs.

| Operation | Current measured time | Query/payload behavior |
| --- | ---: | --- |
| Overview KPI + trends | 1.76 s | Four parallel, compact server queries |
| Property Performance page (20 max) | 1.01 s | Paginated listings plus batched bookings/payments/refunds |
| Host Performance page (20 max) | 2.43 s | Paginated Hosts plus batched listings/bookings |
| Initial server render | Overview only | Property and Host tables load independently after hydration |

No comparable pre-change timing was captured before implementation, so no invented before/after timing is reported. The structural reduction is verified: nested relation payloads were removed and the initial page no longer waits for either performance table.

## Verification

| Check | Result |
| --- | --- |
| `pnpm exec tsc --noEmit` | PASS |
| Targeted ESLint for modified analytics page/routes | PASS |
| Diff whitespace check | PASS |
| Status totals reconcile to booking cohort | PASS (47) |
| 30-day trend includes zero-filled days | PASS (31 points; 13 active) |
| Property pagination has no page-one/page-two overlap | PASS |
| Property inactive/zero-activity scope can be included | PASS (16 operational vs 195 inclusive listings) |
| Host server-side email search | PASS |
| All eight advertised report types generate rows or valid empty results | PASS |
| Non-Admin service access denied | PASS |
| Browser desktop/tablet/mobile interaction test | BLOCKED — no browser session was available |

## Limitations

- There is no booking-status history model, so the trend uses the current state of bookings created on each day rather than fabricating status-change timestamps.
- There is no payout settlement ledger. Stored payout snapshots are reported as recorded values, not paid/settled Host payouts.
- The development database has no payment/refund rows. The financial UI correctly communicates that lack of verified transaction data; payment integration reconciliation remains the source for future records.
