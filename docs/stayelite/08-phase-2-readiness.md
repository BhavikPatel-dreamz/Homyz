# Phase 2 readiness — authoritative event and award foundation

**Phase 1 outcome:** **CONDITIONALLY READY** for an isolated nonfinancial foundation. It is not ready to activate monetary rewards, fulfilment, or policy-blocked achievements.

## 1. Reusable assets

| Existing asset | Use in Phase 2 | Do not do |
|---|---|---|
| `Booking`, completed-confirmed helper, payment/refund records | Source event adapter and reconciliation input. | Treat `endDate` alone or client status as completion. |
| `Review` two-direction model | Published host-rating/guest-review evidence adapter. | Count hidden/deleted or client-submitted reviews. |
| `Destination`/`UserDestination` | Normalization/read-model base. | Use manual destination/photo text as verification. |
| `TravelAchievement`/`UserTravelAchievement` | Definition/progress compatibility/migration base. | Store editable personal stamps as verified awards. |
| `TravelProfile` privacy and public DTO patterns | Recognition projection/public visibility. | Create a duplicate profile/gallery. |
| `ReferralReward`/approval service | Referral review compatibility. | Issue on dashboard read. |
| `BackgroundJob`, notifications, RBAC, `AuditLog` | Durable processors, side effects, permissions/auditing. | Use in-memory fallback for rewards; rely only on `Role.ADMIN`. |

## 2. Required schema/extensions (design only)

Names are indicative; Phase 2 must use the repository’s conventions and migration review process.

| Needed capability | Minimum fields / constraints | Why |
|---|---|---|
| Domain outbox/event | event type/version, aggregate ID/version, occurred time, payload, `deduplicationKey UNIQUE`, consumption/retry metadata | Durable, ordered/idempotent source event processing. |
| Completion marker | booking ID `UNIQUE`, completion instant, source policy/version, reversal reference | Avoid repeated time-based completion being treated as multiple events. |
| Achievement definition version | stable definition key, version, lifecycle, typed rule/config, display/category, effective window | Published rule edits cannot rewrite historical awards. |
| Verified award history | user/definition-version uniqueness, award/revoke state, source event links, evidence snapshot, display preference separately | Protect system awards from user stamp edits/deletes. |
| Booking destination evidence | booking ID + normalized destination/taxonomy version, visit record uniqueness | Supports city/geographic/count rules and reclassification. |
| Tier membership/history | current tier projection plus transition/snapshot/version history | Evaluation and privacy without points conflation. |
| Points ledger/rewards | append-only transaction/reward state, source idempotency, available/reserved projection, funding/reversal terms | Prevent fake balance/double redemption. |
| Taxonomy | destination/country mappings, category flags, language/season/continent versions, provenance/effective window | Trustworthy global/geographic rules. |

## 3. Planned implementation sequence

1. Approve or isolate `DEC-001` and `DEC-017`; add event/outbox and completion evidence with no guest-visible monetary behavior.
2. Add versioned achievement definition/award history and server-only award evaluator interface.
3. Add deterministic completion/review/referral adapters, award idempotency and dry-run reconciliation.
4. Project nonfinancial city/behavior/tier progress only where the governing decision is approved; preserve blocked states as pending/unavailable.
5. Add taxonomy/rule admin design only after the associated decisions; commercial ledger/pricing remains later Phase 6/7 work.

## 4. Migration and rollout risks

- Do not convert literal wallet UI state into balances or transactions.
- Do not backfill awards from `UserTravelStamp`, manual `UserDestination`, photos, captions or catalog selections.
- The previous migration removed automatic travel collection artifacts; new verified awards require a new immutable evidence model.
- Static Tokyo data has a duplicate legacy slug; normalize to stable definition key before seeding definitions.
- Existing `UserDestination` collapses repeated visits; do not assume it proves streak/order/count history.
- Use dry-run reports, cursor/checkpointed backfills, uniqueness constraints, sampling and rollback-by-compensating-record—not destructive delete—before production activation.

## 5. Dependency map

| Phase 2 prerequisite | Status |
|---|---|
| All 30 definitions and thresholds documented | Complete in [01-business-rules.md](01-business-rules.md). |
| Event/idempotency/reversal contract | Complete in [02-achievement-event-contracts.md](02-achievement-event-contracts.md). |
| Tier/reward/referral boundaries | Complete as proposed policy; commercial values remain blocked. |
| Decision isolation | Complete in [07-decision-register.md](07-decision-register.md). |
| Runtime/schema/migration change | Not started, per Phase 1 rules. |

## 6. Phase 2 acceptance criteria

- [ ] Written approval exists for completion/revocation policy or implementation explicitly keeps uncertain criteria non-awarding.
- [ ] A migration design includes a durable outbox, unique event identities and immutable award history.
- [ ] No schema design lets user-owned stamps modify system awards.
- [ ] Every consumer has duplicate, delayed, out-of-order and reversal test cases.
- [ ] Reconciliation is dry-run capable and never uses profile UI/client state as evidence.
- [ ] Public/private projections follow existing profile privacy, with hidden awards omitted from public data.
- [ ] Jobs, notification failures, audit records and observability have operational ownership.
- [ ] Monetary benefit code is explicitly out of Phase 2 unless all associated `DEC-010`, `DEC-011`, `DEC-012`, and `DEC-016` approvals are supplied.
