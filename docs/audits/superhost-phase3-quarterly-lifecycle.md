# HOMYZ — Superhost Phase 3 Quarterly Lifecycle

**Status:** Complete  
**Scope:** Quarterly evaluation execution, immutable history, supported badge transitions, retries, and administrative operations. Phase 1 qualification inputs and Phase 2 qualification rules were reused unchanged.

| Item | Status | Files Changed | Test Evidence |
|---|---|---|---|
| Quarterly evaluation | Complete | `services/superhost.service.ts` | Existing quarterly-window tests plus Phase 3 lifecycle tests. |
| Automatic scheduling | Reused and verified | No scheduler changes | Existing protected internal endpoint, systemd timer, and retrying deployment script are exercised by regression/source tests. |
| Status lifecycle | Complete | `lib/superhost/lifecycle.ts`, `services/superhost.service.ts` | First qualification, renewal, conclusive failure, and blocked preservation tests. |
| Badge renewal | Complete | `lib/superhost/lifecycle.ts` | A renewal preserves the original `superhostQualifiedAt`; an approved first qualification records the checkpoint. |
| Blocked decisions | Complete | `lib/superhost/lifecycle.ts`, `services/superhost.service.ts` | `CANNOT_DETERMINE` never awards a badge and never revokes an existing badge. |
| History consistency | Complete | `services/superhost.service.ts` | Unique `(hostId, evaluationDate)` record, transactional history/status write, and concurrent `P2002` idempotency fallback. |
| Admin operations | Complete | `app/api/v1/admin/superhost/evaluations/route.ts` | Permission-gated current status/history read and safe host/quarter rerun support. |
| Regression testing | Complete | `__tests__/phase3-superhost-quarterly-lifecycle.test.ts` | 35 focused tests passed; TypeScript and focused lint passed. |

## Implemented lifecycle policy

The Phase 2 result remains the only qualification source.

- `ELIGIBLE`: awards the badge for the first time or renews it without changing the original qualification date.
- `NOT_ELIGIBLE`: applies the existing conclusive loss behavior and clears the badge/qualification date.
- `CANNOT_DETERMINE`: writes immutable assessment history with its failure reasons but preserves the prior official badge and qualification date. It never creates a new award.

This means an unresolved cancellation-exception provenance or unknown lifecycle state is visible for review without turning incomplete information into either an award or an unsupported revocation.

## Execution and recovery

- The existing internal endpoint requires `SUPERHOST_EVALUATION_CRON_SECRET` with timing-safe comparison.
- The existing systemd timer runs on the quarterly checkpoints; its deployment script retries transient requests.
- History creation and status updates are in one Prisma transaction.
- Existing history is returned unchanged on ordinary reruns.
- If concurrent workers race past the preliminary history read, the unique-key conflict (`P2002`) is re-read as an idempotent completed assessment instead of creating a duplicate record or badge update.
- A failed host is isolated within the batch and is safe to retry. Already-completed assessments are not rewritten.

## Administrative API

`/api/v1/admin/superhost/evaluations`

- `GET ?hostId=<id>` requires `hosts.view` and returns the current host-level status and immutable assessment history.
- `POST { hostId?, evaluationDate? }` requires `hosts.edit` and safely reruns either one host or the current/selected quarter. The established quarterly-window restriction remains enforced by the service.

No new admin dashboard was added.

## Remaining product decisions

- Approved provenance for Superhost cancellation exceptions is still undefined. Such assessments remain blocked rather than qualifying a host.
- The broader response-rate population policy remains unchanged from Phase 1; this phase does not redefine it.
- There is no schema field that distinguishes a blocked historical assessment from a normal non-qualification. The existing immutable `failureReasons` persists the blocked reasons for administrator review. Adding a dedicated assessment-state field would require an approved schema/product change and was not introduced in this phase.

## Verification

```text
npx tsx -r dotenv/config --test \
  __tests__/phase3-superhost-quarterly-lifecycle.test.ts \
  __tests__/phase2-superhost-qualification-engine.test.ts \
  __tests__/phase1-superhost-eligibility-metrics.test.ts \
  __tests__/phase6-superhost-qualification.test.ts \
  __tests__/phase7-superhost-evaluation.test.ts \
  __tests__/phase12-host-insights-superhost.test.ts \
  __tests__/phase2-guest-favorite-correctness.test.ts

35 passed, 0 failed

npx tsc --noEmit --pretty false
Passed

npx eslint lib/superhost/lifecycle.ts lib/superhost/rules.ts \
  services/superhost.service.ts \
  app/api/v1/admin/superhost/evaluations/route.ts \
  __tests__/phase3-superhost-quarterly-lifecycle.test.ts
Passed
```

No Phase 4 work was started.
