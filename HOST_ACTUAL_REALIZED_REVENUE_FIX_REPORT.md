# Actual Realized Revenue — Completion Report

## Root cause

The Advanced Earnings page rendered Actual Realized Revenue with bespoke flexbox bars. That path had no chart primitive, no responsive measurement, no axes/tooltips, and no component-level loading/error treatment. Consequently, when the visual bars did not paint correctly in the browser, the fixed-height container appeared as a large unexplained blank area even though the summary values were available.

## Fix delivered

The section now maps the existing server-provided completed-stay trend into the already-installed Recharts-based `EarningsInteractiveChart`.

- Real, immutable snapshot values are mapped as net host earnings, eligible accommodation revenue, and recorded host service fees.
- The chart provides responsive sizing, x/y axes, currency ticks, grid lines, hover tooltips, metric selection, and drill-down interaction.
- The card has a prominent selected-period net realized value, a named prior-period baseline, absolute/percentage change, and qualifying-stay context.
- Loading uses a correctly sized skeleton; an API failure uses `Revenue data couldn't be loaded` with retry; no qualifying stays uses `No realized revenue for the selected period.`
- The supporting cards use the same eligible completed-stay booking population: accommodation revenue, net host earnings, revenue per booking, and net per booking.

## Financial definition and reconciliation

Actual realized revenue is **completed-stay settlement eligibility from immutable booking payout snapshots**. It is not a confirmation that a bank transfer has been paid.

Accommodation revenue is the recorded accommodation subtotal. Net host earnings may legitimately be higher or lower because snapshots also contain extra-guest fees, pet fees, cleaning fees, host-collected taxes, and host service fees. The card now displays all of those period totals in a reconciliation explanation instead of implying that net must equal accommodation revenue.

For the reported SAR 9,496 accommodation and SAR 9,694 net example, the SAR 198 difference must come from the recorded snapshot components for that selected account/period. A live database query was not run in this workspace, so this report does not fabricate a component-level attribution; the updated UI exposes it from the authoritative records.

## Changed files

- `app/(protected)/host/earnings/analytics/host-earnings-analytics-client.tsx`
- `services/host-earnings-analytics.service.ts`
- `components/host/reporting/earnings-interactive-chart.tsx`
- `__tests__/actual-realized-revenue-visualization.test.ts`
- Updated focused source-contract tests for the shared chart label customization.

## Verification

Passed:

```text
npx eslint app/(protected)/host/earnings/analytics/host-earnings-analytics-client.tsx \
  services/host-earnings-analytics.service.ts \
  components/host/reporting/earnings-interactive-chart.tsx \
  __tests__/actual-realized-revenue-visualization.test.ts \
  __tests__/advanced-earnings-final-completion.test.ts \
  __tests__/host-earnings-advanced-reporting.test.ts

npx tsx -r dotenv/config --test \
  __tests__/actual-realized-revenue-visualization.test.ts \
  __tests__/advanced-earnings-final-completion.test.ts \
  __tests__/phase13-advanced-earnings-analytics.test.ts \
  __tests__/host-earnings-advanced-reporting.test.ts
```

Result: **19 passed, 0 failed**. `git diff --check` passed.

## Limitation

The page now has a valid compact no-data state when no eligible completed stays exist. Browser-authenticated visual testing and a live account reconciliation for the cited October figures require the deployment database and an authorized test account.
