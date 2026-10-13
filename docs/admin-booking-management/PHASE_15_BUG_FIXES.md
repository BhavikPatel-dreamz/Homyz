# Phase 15 Bug Fixes

| Issue | Severity | Root cause | Files changed | Verification |
| --- | --- | --- | --- | --- |
| Missing-session development Admin access | Critical | `getAuthContext` selected a development Admin when no token resolved. | `lib/auth/context.ts` | Phase 15 security test; TypeScript pass |
| Stale API authorization | High | JWT claims, including permissions, were accepted without live account lookup. | `lib/auth/context.ts`, `lib/auth/session.ts`, `lib/permissions/guards.ts` | Phase 15 security test; TypeScript pass |
| Admin membership inconsistent with primary Host role | High | Guards and ownership checks examined only `role`. | `lib/permissions/authorize.ts`, `page-guards.ts`, `permissions.ts`, `proxy.ts`, `host-application.service.ts` | TypeScript pass |
| Unapproved/duplicate refund processing | Critical | Process path did not require approval or serialize reads of the payment balance. | `services/refund.service.ts` | Phase 15 security test; TypeScript pass |
| Fabricated deferred financial success | Critical | Missing payment records were locally created as captured and refund processing wrote success without a provider. | `services/refund.service.ts` | Phase 15 security test; TypeScript pass |
| Local reconciliation overwrote financial state | High | Reconciliation inferred provider state from local records and updated balances/status. | `services/payment-admin.service.ts`, reconcile route | TypeScript pass |
| Unvalidated refund writes / invalid numeric filter handling | Medium | Raw JSON and `parseInt` results were passed into domain calls. | `lib/validation/admin-booking.ts`, refund/cancellation routes | Phase 15 security test; TypeScript pass |
| Environment diagnostic secret exposure | High | The checker printed non-secret-named configured values verbatim, including connection URLs. | `scripts/check-env.js` | Phase 15 security test; configuration check pass |

No existing records, migrations, or live financial transactions were modified during this phase.
