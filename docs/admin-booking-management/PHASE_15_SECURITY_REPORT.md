# Phase 15 Security Report

## Fixed findings

| Severity | Finding | Resolution | Regression coverage |
| --- | --- | --- | --- |
| Critical | In non-production, a request without a session could resolve to the first database Admin. | Removed the development-admin fallback. Every API caller must present a valid bearer or NextAuth token. | `admin-booking-phase15-security.test.ts` |
| High | API authorization could use stale JWT role/permission claims after status, role, or token-version changes. | API context now reloads live account status, role, admin membership, token version, and effective Admin permissions. Protected page sessions fail closed when live validation fails. | `admin-booking-phase15-security.test.ts` |
| High | Administrative membership on a Host primary role was not consistently honoured; host conversion could overwrite an Admin primary role. | Server/page/proxy guards recognize trusted `adminRole` membership; host conversion preserves an Admin primary role. | Source regression test and TypeScript check |
| Critical | A refund could be processed while pending and unapproved. | Processing now requires an approved pending refund. | `admin-booking-phase15-security.test.ts` |
| Critical | Deferred bookings could receive locally fabricated captured-payment/refund success records. | Only explicit `MOCK` mode can create a sandbox payment/refund result. Deferred and online modes fail closed without a provider adapter. | `admin-booking-phase15-security.test.ts` |
| Critical | Concurrent refund paths did not serialize against the same payment balance. | Refund request and process transactions take a PostgreSQL advisory lock keyed by payment ID and reread the locked balance/reservations. | Source regression test; database concurrency test remains blocked |
| High | Reconciliation could mutate payment status and refunded totals from local rows without verifying a provider. | Reconciliation now reports discrepancies and records an audit event without changing provider-dependent financial state. It also requires `payments.manage`. | TypeScript check; provider integration test blocked |
| Medium | Refund writes accepted unvalidated JSON. | Added strict schemas for request, approve, reject, and process payloads; amount is bounded positive integer minor units. | `admin-booking-phase15-security.test.ts` |
| High | `npm run check-env` printed configured connection strings in logs. | The checker now emits only `[CONFIGURED]` / `[NOT SET / OPTIONAL]`, never values. | `admin-booking-phase15-security.test.ts` |

## Verified controls

- Route handlers use `requireApiAuth`, `requireApiRole`, or `requireApiPermission`; proxy remains only an optimistic redirect layer.
- Suspended and revoked accounts are rejected by `requireApiAuth`.
- Admin financial operations require server-side permissions; reconciliation now requires `PAYMENTS_MANAGE`.
- Refund request/reservation/process logic uses minor units and captured-balance checks.
- Booking creation/acceptance uses transactions and advisory locks; the existing static phase tests cover hold and overlap rules.
- Listing secrets are sanitized in admin-facing booking/payment/refund views; message and CSV sanitizers are present.

## Remaining security risks / blockers

- No signed provider-webhook endpoint or verified provider adapter exists. Live financial processing must remain disabled.
- A full cross-user IDOR test matrix needs seeded Guest A, Guest B, Host A, Host B, restricted Admin, and multi-role accounts; it could not run without a database.
- The primary role column does not represent independent Guest and Host memberships. The existing Admin membership is preserved and recognized, but a general membership migration is required for the stated permanent multi-role model.
