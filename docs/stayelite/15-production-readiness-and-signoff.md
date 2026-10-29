# StayElite Phase 15 — Production Readiness and Sign-off

**Decision: NO-GO — PRODUCTION RELEASE BLOCKED**

This is a release-preparation record, not approval to deploy, migrate, backfill,
or activate a StayElite feature. It is based on the repository state examined on
2026-10-29 and contains no credentials or customer data.

## A. Release baseline

| Item | Evidence / state |
|---|---|
| Branch / baseline commit | `main` / `3b467e5` (`merge branch`) |
| Working tree | 71 changed/untracked paths at inspection. They include substantial pre-existing user work and Phase 2–15 work; none was reset, committed, or discarded. |
| Verified nonfinancial foundation | Event/evidence, destination and quality calculators, tier evaluation, admin definition controls, notifications/activity, analytics, and reconciliation are present. |
| Intentionally inactive | Automatic historical awards; unapproved tier transitions/downgrades; checkout discounts/free nights; points; reward redemption; campaigns. |
| Missing | Authoritative points ledger/account, reward catalog/redemption/fulfillment, and loyalty campaign implementation. |
| Deployment assets | CI workflow, immutable-image release/rollback scripts, `/api/health` liveness, and `/api/ready` dependency readiness exist. |

The Phase 14 definition-level matrix is retained in
[`../audits/phase-14-stayelite-qa-audit.md`](../audits/phase-14-stayelite-qa-audit.md).
It maps all 30 tier/badge/sticker definitions without treating disabled awards as
active functionality.

## B. Final acceptance matrix

| Area | Status | Evidence | Activation requirement / risk |
|---|---|---|---|
| 3 tier calculations | PARTIALLY_VERIFIED | Phase 5 tests exercise Traveler, Ambassador, Icon and duplicate evidence. | DEC-001/004/007/008 plus isolated migrated DB; promotions remain off. |
| 8 city stickers | PARTIALLY_VERIFIED | Phase 3 country-scoped alias and exact-definition tests. | DEC-001/002 and approved award rollout. |
| 6 geographical stickers | BLOCKED_BY_POLICY | Curated taxonomy tests pass; no inferred classification. | DEC-014 and qualified-stay decision. |
| 5 quality badges | BLOCKED_BY_POLICY | Fixture and boundary calculations in Phase 4 tests. | DEC-003/004/005/006. |
| 8 behavioral stickers | BLOCKED_BY_POLICY | Phase 4 threshold tests cover lead time, hosts, guest count and stays. | DEC-001/013/015 where applicable. |
| Guest Travel Profile / privacy projections | PARTIALLY_VERIFIED | Phase 8/9 privacy and badge mapping test suites pass. | Browser/device/accessibility testing remains unavailable. |
| Admin definitions and RBAC | PARTIALLY_VERIFIED | Phase 9/10 route and service tests pass. | Migrate safe target and test with real roles. |
| Booking quote integrity | PASS_VERIFIED | Pricing suite reports 129 assertions; server-calculated totals and idempotency checks pass. | Keep loyalty price adjustment inactive pending DEC-010/011. |
| Referrals | PARTIALLY_VERIFIED | Source identity and tier duplicate-count tests pass. | DEC-007; no ledger issuance. |
| Notifications/activity/analytics | PARTIALLY_VERIFIED | Deterministic in-app notification and aggregate-source tests pass. | External delivery proof, preferences, and historical instrumentation unavailable. |
| Reconciliation | PARTIALLY_VERIFIED | Phase 12 dry-run/default and idempotency guard tests pass. | Isolated migrated DB required; only opt-in source-backed candidate evidence may mutate. |
| Points, wallet, rewards, redemption | NOT_IMPLEMENTED | No authoritative models/services located. | Do not expose or activate commercially. |
| Loyalty campaigns | NOT_IMPLEMENTED | No loyalty campaign service/model located. | Do not expose or activate. |

## C. Policy approval gate

| Decisions | Affected release group | Status / release action |
|---|---|---|
| DEC-001, DEC-002 | completed stay, city award timing | Proposed; keep evidence candidate-only and awards off. |
| DEC-003–006 | quality ratings, cancellation, streak and written-review badges | Blocked/proposed; keep awards off. |
| DEC-007, DEC-008, DEC-009 | referrals, tier lifecycle and boost | Blocked; keep promotions/downgrades/boosts off. |
| DEC-010–012, DEC-016 | discounts, free nights, upgrades, expiry | Blocked/proposed; no financial or operational fulfillment. |
| DEC-013–015 | seasons, geography, language | Blocked; retain progress only. |
| DEC-017 | award revocation and visibility | Proposed; use audited existing correction paths only. |

The actual server controls found are deliberately granular: automatic tier
promotion requires `STAYELITE_TIER_PROMOTIONS_ENABLED=true`; evidence-only
backfill requires `STAYELITE_EVIDENCE_BACKFILL_ENABLED=true`; persistent tier
reconciliation requires `STAYELITE_TIER_RECONCILIATION_PERSIST_ENABLED=true`.
All must remain unset/false for this release decision.

## D. Database and migration gate

Read-only migration inspection found the configured remote environment is not
safe for release validation. Its last common migration is
`20261028110000_add_travel_profile_public_ids`; it lacks the Phase 2, 3, 5, 11,
and 12 StayElite migrations and has five applied migrations absent from this
checkout. Prisma schema validation is not proof that this environment is safe.

Required sequence before reconsidering release:

1. Identify and approve the target environment and take a provider-managed backup.
2. Restore that backup into an isolated environment and verify restoration.
3. Reconcile the unknown migration records with source control; do not use reset
   or migration resolution to conceal the mismatch.
4. Review every additive StayElite SQL migration, apply it first to the isolated
   copy, and run database-backed event/idempotency/reconciliation tests.
5. Capture a second backup, obtain approval, then use `prisma migrate deploy`
   only through the existing gated deployment workflow.

No backup/restore test has been supplied, so recovery is **unverified**.

## E. Build and test evidence

| Command / check | Result |
|---|---|
| `pnpm test:stayelite` | 28 passed, 1 skipped, 0 failed. The skip requires a reachable database with Phase 2 tables. |
| Supplemental profile/pricing tests | 10 passed; pricing test reports 129 assertions. |
| `npx tsc --noEmit` | Passed. |
| `npx prisma validate` | Passed. |
| `git diff --check` | Passed. |
| Local `pnpm build:ci` with non-remote placeholder configuration | Build artifacts including `.next/BUILD_ID` were generated. Terminal exit capture was unavailable after the long-running build; repeat this in CI and retain its final log before treating build as release evidence. |
| Browser E2E / accessibility / load testing | BLOCKED_BY_ENVIRONMENT: no Playwright/Cypress/a11y runner or safe target configured. |

## F. Rollout, monitoring, and rollback

### Permitted rollout sequence

1. **Infrastructure only:** deploy no StayElite activation; validate liveness
   (`/api/health`), readiness (`/api/ready`), queue health, audit logs, and
   database migration compatibility.
2. **Shadow evaluation:** only after safe migration, run bounded dry-run
   evidence/tier/achievement reconciliation; inspect false positives and policy
   blockers. Do not issue awards, points, or tier transitions.
3. **Staging/internal:** approved test accounts and test bookings only. Validate
   RBAC, source evidence, notification intent, and job retry behavior.
4. **Restricted production cohort:** not currently permitted because there is no
   verified server-side cohort control and the database/policy gates are unmet.

### Observability and response

Existing sources: admin job queue health/backlog, audit logs, loyalty delivery
diagnostics, reconciliation-run records, and health/readiness routes. External
alert delivery, paging ownership, payment telemetry, and ledger monitoring were
not verified; they must be supplied before commercial activation.

| Incident | Containment | Recovery / validation |
|---|---|---|
| Duplicate achievement/tier proposal | Disable relevant env activation; preserve history. | Inspect event/idempotency key and audit log; use audited correction only. |
| Queue or notification outage | Pause worker/retries as appropriate; do not claim external delivery. | Inspect job diagnostics; replay only idempotent pending jobs. |
| Reconciliation interruption | Do not delete the run/checkpoint. | Resume the durable cursor batch after source review. |
| Migration failure | Stop deployment; retain backup and migration logs. | Forward-fix from isolated reproduction; never reset/destroy production tables. |
| Application rollout failure | Use existing immutable-image `scripts/deploy/rollback.sh`. | Confirm app and media health endpoints, then inspect logs. |

No migration is classified as safely reversible for production by this audit.
StayElite migrations are additive; recovery requires a reviewed forward fix or a
verified provider restoration procedure, not table deletion.

## G. Safe smoke-test plan

After an approved deployment, execute only read-only/scoped checks: liveness,
readiness, authenticated guest dashboard/profile reads, notification list read,
admin RBAC read, quote read without payment capture, queue diagnostics, and
reconciliation-run status. Do not create a real charge, issue points, backfill
awards, or enable a financial benefit. Record each response and correlation ID
in the release ticket.

## H. Go/no-go decision

**NO-GO — PRODUCTION RELEASE BLOCKED.** The migration chain is divergent, no
safe restored test database exists, financial loyalty modules are absent, key
business decisions are unresolved, and browser/performance/accessibility and
database-backed concurrency verification are unavailable. The inactive,
nonfinancial code foundations may continue through isolated staging only after
the database gate and affected policy decisions are resolved.
