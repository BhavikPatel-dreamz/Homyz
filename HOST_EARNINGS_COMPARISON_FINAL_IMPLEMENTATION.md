# HOMYZ — Earnings Reporting Period Comparison: Final Implementation

**Completed:** 2026-10-26  
**Route:** `/host/earnings`

## Root cause

The existing comparison modal was visually present but treated Period A as a month/year pair. It could therefore calculate a month-only Period B for a weekly, daily, quarterly, yearly, or custom primary period; it did not retain a semantic preset in URL state; and it left stale comparison dates attached after Period A changed. The chart also compared net and gross amounts but did not carry the comparison fee series.

## Reused architecture

- `resolveTimeframeBounds` and `calculateDelta` in `lib/dashboard/reporting-filter.ts`
- Existing `/api/v1/host/earnings` host-scoped reporting service and immutable payout snapshots
- Existing Earnings URL/filter, property selector, currency context, interactive chart, and modal shell
- Existing server-side host permission, suspended-account, and actor-scoped listing enforcement

No ledger, payout workflow, or second comparison system was added.

## Implemented behavior

### Period A and presets

- Period A is read from the active Earnings reporting filter and passed to the modal as exact UTC calendar start/end keys.
- **Prior Period** derives Period B from that exact Period A.
  - Monthly reporting uses the previous calendar month.
  - An in-progress current month compares month-to-date with the same day span of the preceding month.
  - Custom/daily/weekly/other ranges use the immediately preceding equal-duration interval.
- **Prior Year** maps matching calendar dates one year earlier. February 29 resolves to February 28 in a non-leap year.
- Presets are persisted as `comparePreset` in the URL. When Period A changes, the service recalculates the preset Period B rather than retaining stale dates.

### Custom Period B

- Custom mode now clearly separates **Month & year** from **Specific dates**.
- Month selection synchronizes to first/last calendar day; future months are disabled.
- Date-range input validates missing, invalid, reversed, and future ranges inline.
- Closing with Cancel, outside click, or Escape discards the draft and preserves the applied comparison. Disabling comparison removes only comparison URL state.

### Reporting, chart, and KPI updates

- The API validates exact calendar dates before reporting, rejects incomplete or reversed primary/comparison ranges, and returns host financial data with `Cache-Control: private, no-store`.
- Comparison calculations use the same immutable completed-stay financial snapshots, host/listing scope, accounting recognition, and native-currency isolation as Period A.
- The chart now has a real comparison series for Net Earnings, Gross Earnings, and Host Service Fees. A zero-data comparison still displays a labelled comparison series rather than disappearing.
- Earnings shows an active Period A vs Period B summary with Change and Disable actions.
- Period-based Gross Earnings, Realized Net Earnings, and Host Service Fees display current and comparison values. Operational payout, paid-volume, and YTD cards remain correctly labelled and are not forced into arbitrary period comparisons.
- Zero baselines use “New activity” or “No comparable baseline,” never a fabricated 100% change.

## URL and filter behavior

Applied comparison URLs retain property, currency, Period A, and Period B. Presets additionally retain `comparePreset`; custom comparisons retain explicit `compareStartDate` and `compareEndDate`. Direct links reconstruct the comparison. Property and currency changes preserve Period B. Disabling comparison removes the comparison keys without altering Period A.

## Updated files

- `lib/dashboard/reporting-filter.ts`
- `components/host/reporting/period-comparison-modal.tsx`
- `components/host/reporting/earnings-interactive-chart.tsx`
- `app/(protected)/host/earnings/host-earnings-client.tsx`
- `app/api/v1/host/earnings/route.ts`
- `services/payout.service.ts`
- Existing advanced Earnings and booking-analytics callers were updated for the modal’s explicit Period B contract.
- `__tests__/earnings-comparison-periods.test.ts`
- `__tests__/host-earnings-advanced-reporting.test.ts`

## Actual verification

Passed:

```text
npx tsx -r dotenv/config --test \
  __tests__/earnings-comparison-periods.test.ts \
  __tests__/host-earnings-advanced-reporting.test.ts
```

Result: **13 passed, 0 failed**. This covers current-month-to-date comparison, prior period, prior year, custom ranges, January/year boundaries through shared date arithmetic, leap day mapping, zero baselines, stale-preset avoidance, URL date validation, Escape handling, and existing chart/reporting contracts.

Previously in this implementation pass, the Earnings overview/reports/advanced-earnings regression group passed: **24 passed, 0 failed**.

Focused ESLint for the changed UI/filter/API/test files passed with no errors. `git diff --check` passed.

`npx tsc --noEmit` was invoked; this workspace’s full graph runs beyond the interactive command window, so no completion status is claimed here. The full existing `services/payout.service.ts` also has pre-existing `no-explicit-any` lint errors outside this change; the modified comparison code introduced none.

## Remaining limitations

- No authenticated browser runner or seed financial data was provided, so visual mobile interaction, browser back/forward, and live payout/provider scenarios still require staging validation.
- The reporting timezone remains the application’s established UTC calendar basis; no synthetic FX conversion, historical backfill, or fabricated payout data was introduced.
