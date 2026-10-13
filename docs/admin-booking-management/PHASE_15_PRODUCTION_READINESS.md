# Phase 15 Production Readiness

## Decision: Not Ready

| Area | Assessment | Reason |
| --- | --- | --- |
| Security | Improved, not fully verified | Critical local authorization/refund defects were fixed, but cross-account tests require a database fixture. |
| Functional | Partially ready | Core source paths and static tests exist; database-backed end-to-end workflows were not run. |
| Database | Not verified | No non-production database was supplied; schema/migration was inspected only. |
| Payment/refund | Not ready for live use | No verified provider adapter, signed webhook verification/deduplication, capture flow, or provider reconciliation exists. Processing is intentionally fail-closed outside `MOCK`. |
| Payouts | Not ready for live use | Tracking exists; no provider transfer execution/reconciliation exists. |
| Performance | Not verified | No representative database, request timings, query plans, or browser traces were available. |
| Monitoring | Partially implemented | Audit events and error logging exist, but production monitoring/alert wiring was not verified. |
| Deployment | Blocked | Required local configuration validates, but the full lint did not finish within the run limit, production build did not complete within the two-minute bounded check, and no deployment environment was inspected. |

## Configuration and deployment requirements

- Validate `DATABASE_URL`, `NEXTAUTH_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, URLs/origins, Redis, media storage, email/SMS, and cron secrets with `npm run check-env` in the target environment.
- Keep `PAYMENT_MODE` out of live processing until an adapter, provider credentials, signed webhook endpoint, replay protection, and sandbox test evidence are present.
- Schedule and monitor request-expiry, refund reconciliation, and existing evaluation jobs; alert on failures without logging payment credentials or private evidence.
- Apply the additive migration with `prisma migrate deploy` only after a backup, lock-impact review, and rollback rehearsal. Its foreign keys use `RESTRICT`; it does not drop financial tables.
- Use the existing deployment rollback script only after verifying an application/database compatibility rollback plan.

## Release gates

1. Provide a seeded staging database and complete the authorization, concurrency, report/export, and error-state matrix.
2. Finish lint and production build successfully.
3. Deploy and verify migration in staging, including query plans for booking/refund/payment list workloads.
4. Complete payment-provider sandbox, webhook signature/replay, capture/refund timeout, and reconciliation tests.
5. Decide and migrate the permanent multi-role membership model if independent Guest/Host/Admin memberships are required.
