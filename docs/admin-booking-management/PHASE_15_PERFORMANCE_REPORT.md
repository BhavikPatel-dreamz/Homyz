# Phase 15 Performance Report

No response-time figures are reported: there was no configured `DATABASE_URL` for the test process, so representative endpoints could not be timed against equivalent data. The table deliberately uses **Not measured**, not estimates.

| Page/API | Before | After | Optimization / review | Result |
| --- | --- | --- | --- | --- |
| Booking dashboard | Not measured | Not measured | Existing aggregate/parallel queries and indexes inspected. | Unverified |
| All bookings | Not measured | Not measured | Existing server pagination (`take <= 100`), query filters, stable sort and booking indexes inspected. | Unverified |
| Booking details/activity | Not measured | Not measured | Existing bounded activity read (`take: 20`) inspected. | Unverified |
| Calendar | Not measured | Not measured | Existing listing/month scoped reads and UTC date helpers inspected. | Unverified |
| Refunds | Not measured | Not measured | Pagination is bounded; amount query input is now validated; balance reads are serialized by payment lock. | Unverified |
| Payments | Not measured | Not measured | Sort field/direction are now allowlisted in the service. | Unverified |
| Notifications | Not measured | Not measured | Existing paginated list and summary endpoints inspected. | Unverified |
| Analytics | Not measured | Not measured | Existing currency-separated aggregation and export sanitizer inspected. | Unverified |

## Evidence-based observations

- The migration adds indexes for booking status/date, payment/refund keys/status/date, and audit resource lookup.
- The booking service uses listing- and request-scoped advisory locks for final availability checks.
- Financial mutations now use a payment-scoped advisory lock, avoiding a stale read while another refund request/process transaction is active.
- No production request profiling, query plan, browser render profile, or duplicate-fetch network trace was available; none is claimed.

## Required follow-up

Capture before/after timings and `EXPLAIN (ANALYZE, BUFFERS)` against a representative non-production dataset for every row above. Record record counts, parameters, database time, total time, and the dataset version before accepting any performance claim.
