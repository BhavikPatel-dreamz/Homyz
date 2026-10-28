# HOMYZ — Superhost Phase 2 Qualification Engine

**Status:** Complete  
**Scope:** Centralized, host-level Superhost eligibility only. No scheduler, badge UI, database migration, or Guest Favorite redesign was introduced.

## Result

| Requirement | Before | After | Evidence |
|---|---|---|---|
| SH-03 Good standing | A boolean derived from `User.status === ACTIVE`, without an explainable policy result. | The canonical `User.status` lifecycle is evaluated centrally: `ACTIVE` passes, `SUSPENDED` and `INVITATION_PENDING` fail, unknown/missing status blocks. | `lib/superhost/rules.ts`, `lib/auth/session.ts`, `lib/permissions/host-permissions-server.ts`, Phase 2 tests. |
| Qualification engine | Scalar flags and an `eligibleNow` boolean only. | A single evaluator returns six named criteria, actual values, thresholds, pass/fail/blocked status, explanations, failure reasons, and an overall result. | `evaluateSuperhostRequirements()` in `lib/superhost/rules.ts`. |
| Host-level aggregation | Existing owned-HOME listing aggregation. | Preserved unchanged; its results now feed the structured host-level decision. | `services/superhost.service.ts`, Phase 1 and Phase 2 regression tests. |
| Eligibility results | No distinction between ordinary failure and unverifiable data. | `ELIGIBLE`, `NOT_ELIGIBLE`, and `CANNOT_DETERMINE`; assessment period, missing information, and unresolved dependencies are included. | `SuperhostQualificationResult`. |
| Status/history compatibility | Quarterly history and official status used the existing booleans. | Preserved. Quarterly records retain their existing fields and persist `qualified` from the centralized result; no historical records or scheduling lifecycle were changed. | `evaluateHostAtQuarterlyCheckpoint()` in `services/superhost.service.ts`. |
| Guest Favorite separation | Separate listing-level qualification service. | Preserved; Superhost remains host-account-level and neither service imports the other's evaluator. | `services/superhost.service.ts`, `services/guest-favorite.service.ts`, Phase 2 test. |
| Regression testing | Phase 1 and prior Superhost tests existed. | Focused Phase 2 tests cover standing, full eligibility, each required threshold, insufficient response data, cancellation exception safety, structured period/result, and Guest Favorite separation. | `__tests__/phase2-superhost-qualification-engine.test.ts`. |

## Approved good-standing policy

`User.status` is the authoritative, enforced Homyz account lifecycle: suspended accounts lose access immediately and inactive hosts receive denied effective permissions. Phase 2 therefore uses only this documented control.

- `ACTIVE`: passes good standing.
- `SUSPENDED`: fails good standing.
- `INVITATION_PENDING`: fails because host activation is incomplete.
- Missing or unrecognized state: blocks qualification rather than assuming eligibility.

Identity data, compliance records, moderation reports, warnings, disputes, and listing licences are not independently added as Superhost disqualifiers. The repository does not define such a Superhost rule, so treating them as automatic failures would invent policy.

## Blocked paths and unresolved decisions

- A host cancellation marked `isExcluded: true` is not accepted as a qualification exception merely because the flag exists. Until Homyz provides an approved, auditable exception source, the cancellation criterion is `BLOCKED` and the overall result is `CANNOT_DETERMINE`.
- SH-10 response-rate population semantics remain a product decision. Phase 2 deliberately keeps the established calculation unchanged: one qualifying guest inquiry per conversation, non-system messages only, and a 24-hour boundary. A missing qualifying inquiry remains a normal response-rate failure, not a fabricated pass.

## Files changed

- `lib/superhost/rules.ts`
- `services/superhost.service.ts`
- `__tests__/phase2-superhost-qualification-engine.test.ts`
- `docs/audits/superhost-phase2-qualification-engine.md`

Phase 2 also relies on the already-completed Phase 1 review publication, cancellation write safety, response reducer, and aggregation behavior without rewriting them.

## Verification

```text
npx tsx -r dotenv/config --test \
  __tests__/phase2-superhost-qualification-engine.test.ts \
  __tests__/phase1-superhost-eligibility-metrics.test.ts \
  __tests__/phase6-superhost-qualification.test.ts \
  __tests__/phase7-superhost-evaluation.test.ts \
  __tests__/phase2-guest-favorite-correctness.test.ts

28 passed, 0 failed

npx tsc --noEmit --pretty false
Passed
```

No Phase 3 scheduler/concurrency work was started.
