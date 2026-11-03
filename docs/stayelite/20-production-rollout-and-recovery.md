# StayElite production rollout and recovery

## Preconditions

1. Rotate the externally exposed credential and store the replacement only in approved secret management.
2. Take and restore a provider backup into an approved isolated PostgreSQL environment.
3. Reconcile the remote-only migration records with source control; do not reset, delete tables, or force migration resolution.
4. Review and apply the complete additive migration chain, including `20261029110000_add_stayelite_points_rewards_campaigns`, only in isolation.
5. Run database-backed outbox, ledger, redemption race, reversal, reconciliation, authorization, and migration smoke tests with `STAYELITE_DB_TESTS=true`.
6. Obtain documented decisions DEC-001 through DEC-017 as applicable.

## Activation gates

- Keep award, promotion, evidence-backfill, tier-reconciliation, and points-redemption flags unset/false.
- Never enable `STAYELITE_POINTS_REDEMPTION_ENABLED` without an approved commercial policy version, migrated database, race-condition evidence, catalog/funding/fulfilment contract, monitoring, and rollback ticket.
- Keep new rewards and campaigns in draft; no seed contains a price or value.

## Recovery

- For application failure, use the existing immutable-image rollback procedure and validate health/readiness.
- For ledger/reward anomalies, disable activation, preserve all source events and ledger records, inspect idempotency/audit references, and create compensating entries only; never edit or delete ledger history.
- For migration failure, stop deployment and forward-fix from the isolated reproduction or restore a verified provider backup. Never use `migrate reset` on customer data.
- For reconciliation interruption, retain run/checkpoint data and resume bounded processing only after source review.

External monitoring, paging, and backup restoration are not verified by this audit and remain release gates.
