# Host Dashboard Standard and Dashboard Plus

## Audit finding

Homyz has host RBAC and payment/payout functionality, but it has no subscription
plan, subscription status table, checkout, recurring billing, upgrade/downgrade,
or renewal workflow. `User.personalInfo` is the existing private host-account
field suitable for a minimal read-only entitlement state. No new billing table,
pricing, payment provider flow, or simulated purchase was added.

## Entitlement contract

`lib/entitlements/host-dashboard.ts` is the only Dashboard Plus access matrix.
It resolves entitlement on the server from the authenticated host's
`User.personalInfo.dashboardPlus` value:

```ts
{
  status: "ACTIVE" | "TRIAL" | "EXPIRED" | "CANCELLED" | "SUSPENDED" | "ADMIN_GRANTED",
  expiresAt?: string, // ISO date-time
}
```

Missing or malformed state is safely treated as Standard. An active or trial
record with a future (or omitted) expiry unlocks Plus. An elapsed expiry turns
active, trial, or admin-granted profile state into effective `EXPIRED`. Admins
have a server-side support entitlement. The resolver never writes account data
or charges a host.

Dashboard Plus is account-scoped: the signed-in host's entitlement controls
their access. An accepted co-host may access analytics only for listings they
are assigned to, but does not inherit the primary listing owner's Plus status.
This matches the existing user-account model; there is no business-account or
listing-subscription model in the current schema.

## Feature matrix

| Area | Standard | Dashboard Plus |
| --- | --- | --- |
| Dashboard, reservations, calendar, payouts | Available | Available |
| Earnings | Monthly/YTD totals, payouts, basic graph and fee breakdown | Advanced earnings analytics and RevPAN |
| Insights Stats | Occupancy, booked nights, booking value and stay length, cancellations, guest origin/returning guests, check-in statistics | Advanced booking behavior, booking-time and lead-time reports, and detailed property comparison |
| Listing performance | Listing health, views, basic conversion, price comparison, basic opportunities | Comparable listings, peer benchmarks, comparison history, cancellation-policy benchmarking, and booking lead-time analysis |
| Reviews and standard host management | Available | Available |
| Operations | Not exposed | Cleaning, maintenance, recorded operating costs, and profitability context |
| Forecasting, AI copilot, pricing autopilot | Not implemented | Explicitly deferred; no entitlement is exposed for an unimplemented capability |

The comparison uses one shared dashboard/data architecture. The mixed listing
performance page remains usable for Standard hosts; only its advanced response
fields are redacted server-side.

Advanced guest intelligence, guest lifetime value, booking-source attribution,
advanced demand analysis, and dynamic-pricing history are not currently
implemented as host reports. They have no invented data or placeholder API and
are deferred until a separately approved implementation exists.

## Server-side protection

The following direct routes and APIs resolve the entitlement using the current
authenticated actor before returning Plus data or permitting Plus actions:

| Capability | Page | API |
| --- | --- | --- |
| Advanced earnings | `/host/earnings/analytics` | `/api/v1/host/earnings/analytics` |
| RevPAN | `/host/earnings/analytics/revpan` | protected by the advanced earnings API |
| Booking behavior | `/host/insights/stats/booking-analytics` and metric detail routes | `/api/v1/host/insights/booking-analytics` |
| Operations | `/host/operations` | `/api/v1/host/operations` and `/api/v1/host/operations/cleaning/[id]` |
| Advanced listing comparison | mixed listing-performance page | advanced fields are withheld by `/api/v1/host/insights/listing-performance` |

Authorization is evaluated after the existing host-role checks, so a caller must
still be an authorized host and can never use a client-supplied plan value to
bypass a Plus check. Refusals use the existing consistent `403` application
error path. Host insights and Plus API responses are explicitly private and
non-cacheable, and their browser refresh requests use `cache: "no-store"`, so a
previous account's entitled response is not reused after an account switch.

## UI behavior

Standard hosts continue to see their existing basic dashboard, earnings, and
Insights data. The Stats view presents an explanatory Dashboard Plus preview
instead of a usable advanced-data link. Mixed listing performance keeps basic
price comparison and replaces withheld comparison content with a concise Plus
explanation. Entitled hosts retain the live advanced links and data.

## Billing follow-up

To complete upgrades and downgrades, a future billing integration must:

1. Persist verified lifecycle events into the documented profile state (or move
   that state into a dedicated subscription model when one exists).
2. Set `ACTIVE`, `TRIAL`, cancellation/effective expiry, suspension, and renewal
   failure dates based on the provider's verified webhook events.
3. Provide a real checkout and billing-management UI. Until then, the UI makes
   no purchase claim and no payment is created.

Expiry only removes Plus access. It does not delete host, booking, payout, or
historical analytics data.

## Verification

- `pnpm exec tsx -r dotenv/config --test __tests__/host-dashboard-entitlements.test.ts` — 4 passing tests for Standard fallback, active/trial access, expired/cancelled/suspended access removal, and admin access.
- `pnpm exec tsx -r dotenv/config --test __tests__/host-dashboard-financial-consistency.test.ts` — 2 passing regression tests.
- `pnpm exec eslint` on the changed entitlement, service, and protected API files — passed.
- `pnpm exec tsc --noEmit` — passed.
- `git diff --check` — passed.

Additional source-contract tests cover the protected page/API route wiring,
non-cacheable account responses, and accepted co-host listing scope. They do
not replace full authenticated browser or HTTP integration tests.

The entitlement tests cover the deterministic server-side state resolution. Full
provider checkout, subscription-webhook, and real multi-account browser tests
remain pending because no billing provider or subscription entities exist in
this deployment.

The two client `.docx` source specifications referenced by the task were not
present in the repository, so the matrix is verified against the supplied task
requirements rather than a file-level comparison with those documents.
