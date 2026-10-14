# Financial settlement audit and fix

Date: 2026-10-14

## Evidence-based findings

### Payments showed SAR 0

This was not a verified zero balance. `services/payment-admin.service.ts` caught a Prisma `P2021`/`BookingPayment` missing-table error and returned a synthetic all-zero summary. The connected database also has migration-history drift: `prisma migrate status` reports that `20261010140000_admin_booking_foundation` (which creates `BookingPayment` and `BookingRefund`) has not been applied, while the database contains `20261007000000_add_host_guest_reviews`, which is absent from this checkout. The payment foundation migration cannot safely be deployed until that drift is reconciled.

The service now reports an actionable 503 instead of presenting missing records as SAR 0.

### Refund loading and zero totals

Refund list and summary had the same missing-table fallback: an unavailable `BookingRefund` table was presented as an empty dataset. It now returns an actionable 503. The UI therefore terminates in an error state rather than an endless load or false zero totals.

### Payout totals and Gross versus Net

Payouts are derived from `Booking.priceBreakdown.payoutBreakdown`, not a payment-provider settlement ledger. Earlier code could treat a confirmed booking with no payment rows as captured and estimate a legacy host commission at 15%. Those are not verifiable payable funds.

The payout calculator now:

- requires an actual captured payment row;
- requires an immutable stored payout snapshot;
- blocks settlement when captured funds are below the stored entitlement;
- sends any completed-refund record without an explicit host-entitlement adjustment to `REQUIRES_REVIEW`; and
- includes a verified payout method when computing the admin summary.

As a result, historical Gross/Net values cannot be accepted as evidence of a valid settlement until the original snapshot, captured funds, and refund adjustments reconcile. No arbitrary commission rate is applied.

## Gateway and settlement capability

`lib/payment/moyasar-adapter.ts` declares `hostTransfersPayouts: false` and `payoutStatusTracking: false`. It can model payment capture, payment verification, voids, and refunds, but it does not implement marketplace host-bank transfers.

The current environment has neither `MOYASAR_API_KEY` nor `MOYASAR_WEBHOOK_SECRET`; `PAYMENT_MODE` is also unset, which defaults to `DEFERRED`. Consequently, the system cannot verify live captures, authenticate provider webhooks, submit live refunds, or execute/verify host-bank payouts.

## Changes implemented

- `services/payment-admin.service.ts`: missing payment financial tables now raise an actionable service-unavailable error instead of fabricated zero KPIs.
- `services/refund.service.ts`: missing refund tables raise an actionable error; refund processing only submits through a configured Moyasar payment path and leaves the refund `PROCESSING` until a signed provider webhook confirms it. Local captured/refunded balances are not changed on submission.
- `services/booking.service.ts`: booking confirmation no longer implies captured funds for refund calculations. Guest, host, and admin cancellations create pending refund requests instead of fabricated provider refund IDs or successful refunds; they do not mutate captured/refunded balances before provider confirmation.
- `services/payout.service.ts`: no estimate is generated for legacy payouts without an immutable snapshot; capture and refund mismatches require review. The payout execution endpoint is deliberately disabled with a 503 because no approved bank/disbursement provider or verification callback exists.
- `app/(protected)/admin/bookings/payouts/admin-payouts-client.tsx`: removes the settlement action and explains that an eligible payout is only ready for bank-batch preparation, not bank-settled.

## How a host payout can currently be handled

The application can maintain a masked, admin-verified host payout method and can export eligible rows for an approved corporate-banking batch. Exporting does not allocate, submit, or settle a payout. An operator must use an approved external banking workflow; this application must not mark the payout paid until an approved integration supplies independently verified execution evidence (reference, recipient, amount, currency, and final bank status).

## Tested results

| Check | Result |
| --- | --- |
| `prisma migrate status` | **Blocked** — migration history drift described above. No migration was applied. |
| Environment configuration check | **Pass** — application-required variables are configured; payment gateway credentials are absent. |
| `npx tsc --noEmit` | **Pass** — completed with no diagnostic output. |
| Targeted ESLint | **Fail (pre-existing debt)** — 129 `no-explicit-any` errors and one React effect rule error remain across the existing financial services/client; these were not expanded to an unrelated type/lint refactor. |
| `npm run build` | **Blocked by runner limit** — Next 16 began the optimized production build successfully, but did not complete before the 30-second command limit. |
| Live/sandbox payment, refund, and bank payout | **Not run** — no authorized gateway credentials, configured webhook secret, reconciled financial schema, or approved bank-disbursement integration. |

## Remaining production blockers

1. Reconcile the migration history with the database owner, then apply `20261010140000_admin_booking_foundation` through the approved migration process. Do not manually create financial rows to backfill the dashboards.
2. Provision non-production Moyasar API and webhook credentials, configure `PAYMENT_MODE=ONLINE_AUTHORIZATION`, and verify signed capture/refund webhooks against provider test records.
3. Implement an approved host-disbursement provider or an auditable bank-confirmation ingestion process before enabling payout submission or `PAID` transitions.
4. Reconcile legacy confirmed bookings and payout snapshots against provider reports before classifying them as payable. Any booking without a capture reference, immutable entitlement snapshot, or explicit refund adjustment must remain under review.
