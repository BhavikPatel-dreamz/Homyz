# StayElite outstanding decisions and blockers

| Blocker | Impact | Required owner action |
|---|---|---|
| DEC-001–002 | Completion evidence and city-award timing | Product approval and source-event acceptance tests. |
| DEC-003–006, 009 | Cancellation, ratings, review quality, streaks, progress boost | Product/policy approval before any award or points issuance. |
| DEC-007–008 | Referral qualification and tier downgrade/expiry | Fraud/product approval; keep membership transitions inactive. |
| DEC-010–012, 016 | Discounts, free night, upgrade/late checkout, expiry | Finance/host/operations approval, pricing/settlement and refund contract. |
| DEC-013–015 | Seasons, geography and language taxonomy | Data-governance approval and versioned source data. |
| Remote migration divergence | All database-backed activation | Restore a backup into an approved isolated PostgreSQL target; reconcile five remote-only migrations and test the complete chain. Do not reset or force migration history. |
| New points/reward migration | Financial foundation | Review additive SQL, apply only to isolated target, then execute concurrency/idempotency/reconciliation tests. |
| Credential exposure report | Security | Rotate the externally exposed provider credential through its owner/provider; replace only in the approved secret store, revoke old key, and validate without disclosing either value. |
| Browser/a11y/performance/backup restore | Release assurance | Configure a safe target and retained CI artifacts; measure and document results. |

All independent code work that does not require these approvals remains complete and inactive. No blocker is represented as an implicit product decision.
