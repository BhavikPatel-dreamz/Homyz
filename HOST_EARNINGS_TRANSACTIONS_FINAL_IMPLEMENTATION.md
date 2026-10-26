# Host Earnings Transactions — Final Implementation

## Root cause

`/host/earnings/transactions` had transaction components, a secured list API,
CSV export, and a transaction-detail route, but no Next.js `page.tsx` at the
index route. Next therefore rendered the unavailable-route state instead of
the existing transaction UI.

## Delivered route and data source

- Added `app/(protected)/host/earnings/transactions/page.tsx`.
- The route is dynamic, requires `HOST` or `ADMIN`, reads URL filter state,
  and supplies the existing transaction client with the unified `all` ledger.
- Reused `payoutService.listHostEarningsTransactions`; no payment or payout
  records are created and no immutable payout snapshot is recalculated.
- The ledger has one row per confirmed booking with a stored payout snapshot.
  `PAID` represents an executed payout; `SCHEDULED`, `ELIGIBLE_SETTLEMENT`,
  and `PROCESSING` remain payable—not paid—records.

## UI and navigation

- Header: **Transactions**, the requested financial-history subtitle, Back to
  Earnings, and active settlement-currency context.
- Search, listing, date, payout-status, and sort filters work through the
  server API. Date filters support historical and upcoming ranges where
  relevant.
- Added 10, 20 (default), 25, and 50-record page sizes with URL-backed
  previous/next pagination.
- The summary explicitly labels a combined recorded-host-earnings amount and
  separately shows completed payout transfers and pending host earnings. All
  totals stay separated by settlement currency; no FX conversion is implied.
- Each row identifies the supported type (host payout), booking reference,
  payout date, amount, currency, real payout state, and links to the existing
  secured detail page. The detail view already presents reservation, immutable
  breakdown, refunds, adjustments, payout timeline, and booking navigation.
- Added **View all transactions** from Earnings. Existing analytics and
  account-settings links now resolve to a real index page.

## Export and reconciliation

- CSV now accepts the unified `all` transaction scope and preserves the same
  supported filters, host authorization, and settlement-currency filter.
- Export columns include transaction ID (settlement reference when recorded),
  reservation ID, type, financial date, property, guest, gross earnings,
  platform fee, net payout, currency, and status.
- Paid rows use the stored execution date. Other rows use their stored
  scheduled payout date. This is exposed as a mixed financial-date basis in
  the UI rather than treating scheduled earnings as completed transfers.

## Security and access

- List, detail, and export routes authenticate server-side; no browser-supplied
  host ID is trusted.
- Listing scope uses accepted co-host assignments as well as host ownership.
  The signed-in host/co-host must also retain the existing `earnings.view`
  permission; administrators retain their established support scope.
- Standard hosts access the basic transaction ledger. There is no Dashboard
  Plus entitlement gate; advanced analytics remains in its existing area.

## Performance and responsive behavior

- Filtering and pagination are performed by the payout service/API; the
  browser receives only the selected page. Export intentionally requests the
  full authorized, filtered result set.
- Existing compact responsive transaction rows, mobile date sheet, loading
  state, retryable API error state, and empty state are reused.

## Files changed

- `app/(protected)/host/earnings/transactions/page.tsx`
- `app/(protected)/host/earnings/host-transactions-client.tsx`
- `app/(protected)/host/earnings/host-earnings-client.tsx`
- `app/api/v1/host/earnings/transactions/route.ts`
- `app/api/v1/host/earnings/export/route.ts`
- `services/payout.service.ts`
- `__tests__/host-earnings-transactions-final.test.ts`
- `__tests__/phase5-host-transaction-details.test.ts`

## Verification

Passed:

- Focused ESLint on the changed route, client, API, export, navigation, and
  test files.
- `npx tsx -r dotenv/config --test __tests__/host-earnings-transactions-final.test.ts __tests__/phase4-host-earnings-transactions.test.ts __tests__/phase5-host-transaction-details.test.ts` — 11/11 passed.
- `git diff --check`.

`npm run build` compiled the application successfully, including the new route,
but its final TypeScript check is currently blocked by two unrelated existing
errors:

- `app/(protected)/host/account-settings/payouts/routing-rules/page.tsx:75`:
  unsupported `actionLabel` prop passed to `SettingsHelpCard`.
- `scripts/backfill-payout-methods.ts:35`: `null` is not a valid Prisma JSON
  input value.

The full repository lint command was not used as a pass/fail production check:
`services/payout.service.ts` already contains unrelated legacy `any` lint
violations outside this transaction change. No schema migration or data
backfill is required for this route.
