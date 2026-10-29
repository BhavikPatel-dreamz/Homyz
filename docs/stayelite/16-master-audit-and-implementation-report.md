# StayElite master audit and implementation report

Audit date: 2026-10-29. This report records repository and command evidence only.

## Baseline and preservation

- Baseline: `main` at `d48edbd`.
- Pre-existing untracked release documents `16` through `20` were preserved and refreshed; no reset, clean, deployment, production migration, payment, refund, or backfill was performed.
- The configured database is remote and was treated as non-isolated. A prior test had been capable of writing to it; the test now requires explicit `STAYELITE_DB_TESTS=true` before it can mutate any database.
- The repository contains no separate original "Loyalty Program: StayElite" source document beyond `docs/stayelite/`; the available specifications and prior audit reports were used as the source of truth.

## Verified implementation

The repository contains an inactive, server-side StayElite foundation: booking/review outbox records and evidence, destination aliases and taxonomy, quality/behavior calculation, three-tier evaluation, owner-safe projections, admin definition/RBAC controls, in-app notification/activity projections, analytics, and bounded reconciliation.

This audit added:

- hard-fail secret handling for CMS preview tokens and payout encryption; no embedded credential fallback remains;
- optional CARTO configuration without an embedded key;
- explicit isolated-database opt-in for the database mutation test;
- a new additive points/rewards/campaign schema and migration (`20261029110000_add_stayelite_points_rewards_campaigns`), with non-negative account checks, immutable-ledger triggers, source/idempotency uniqueness, reserve/commit/release service logic, and no seeded balances/rewards;
- granular points, reward, campaign, and history permissions; and
- regression coverage for the security and points foundations.

The new financial foundation is **not activated**: there is no public redemption route, no reward catalog seed or price, no opening balance, and reward reservation needs both `STAYELITE_POINTS_REDEMPTION_ENABLED=true` and a commercial policy version. Zero-Cancel Pro is represented as exactly 300 points but issuance remains policy-gated.

## Confirmed defects fixed

| ID | Finding | Resolution |
|---|---|---|
| SEC-01 | Runtime credential fallbacks were embedded in source. | Removed; missing server secrets now fail safely. A dedicated `PAYOUT_ENCRYPTION_KEY` is documented while compatibility with existing server-secret-encrypted rows is retained pending an approved rotation. |
| QA-01 | Phase 2 database test could mutate any configured database. | Added explicit isolated-test opt-in; normal regression skips it. |
| FIN-01 | No authoritative points/reward/campaign persistence existed. | Added inactive append-only foundation and additive migration; live migration/concurrency proof remains blocked. |

## Phase disposition

| Phase | Status |
|---|---|
| 0–5 | Implemented foundations/calculators verified by deterministic tests; award and promotion activation is policy-gated. |
| 6 | Foundation implemented and unit-verified; migration and database concurrency validation blocked. |
| 7 | Eligibility metadata only; monetary/operational fulfilment blocked by DEC-010–012/016. |
| 8–12 | Partial reusable guest/admin/notification/reconciliation implementation; browser and live-job proof unavailable. |
| 13 | Security fixes implemented; full external secret rotation, performance, and operational monitoring still require environment access. |
| 14–15 | Deterministic regression evidence collected; production release is blocked. |

## Acceptance decision

**NO-GO — PRODUCTION RELEASE BLOCKED.** The remote migration history diverges from this checkout, the new migration is unapplied, no approved isolated restored database exists, commercial policy decisions remain unresolved, and browser/accessibility/performance/backup-restore evidence is unavailable.
