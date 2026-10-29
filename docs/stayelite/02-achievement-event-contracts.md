# StayElite achievement event contracts

**Status:** proposed architecture v1.0. This does not create event enums, jobs, or handlers.  
**Related:** [business rules](01-business-rules.md), [tier policy](03-loyalty-tier-policy.md), [Phase 0 audit](../audits/phase-0-stayelite-loyalty-achievement-audit.md).

## 1. Authoritative completion and event envelope

The current booking record remains `CONFIRMED` after checkout and the existing helper derives completion from checkout time. Phase 2 must emit a durable `STAY_COMPLETED` only after: booking is confirmed, the configured checkout instant has passed, payment/booking has no defined disqualifier, and a deterministic completion worker/reconciler has evaluated it. Passing `endDate` alone is not a new persistent completion state.

Every domain event requires:

```text
eventId                 immutable UUID/CUID
eventType               stable contract name
aggregateType/id        BOOKING|REVIEW|REFERRAL|AWARD|TIER|REWARD + source ID
occurredAt              authoritative domain timestamp
deduplicationKey        unique: <eventType>:<aggregateId>:<sourceVersion>
payloadVersion          contract version
causationEventId        nullable parent event
actorId                 nullable system/admin/user actor
payload                 minimal source snapshot / identifiers
```

The outbox record and source-state mutation occur in one database transaction. A worker writes derived awards/ledger records with unique constraints and then marks its consumption state. Notifications are downstream best-effort effects, never the evidence of an award.

## 2. Event contract map

| Event | Trigger/preconditions and source | Consumers / order | Deduplication, audit and reversal |
|---|---|---|---|
| `BOOKING_CONFIRMED` | Booking service transition to confirmed; source `Booking.id`, confirmed timestamp, listing/location snapshot. | Capture Early Bird/Last Minute candidate facts only. | Key uses booking version; cancelled booking later invalidates candidate facts. Audit system action. |
| `STAY_COMPLETED` | Completion worker/reconciler after confirmed checkout policy; source booking + property time snapshot. | Destination evidence → city/geographic/stay/behavior rules → tier/referral evaluation. | One completion marker/event per booking; retries no-op. Subsequent refund/cancellation emits reversal. |
| `BOOKING_CANCELLED` | Existing booking cancellation path, with cancellation actor/reason. | Zero-Cancel calculation; invalidate unconsumed benefit candidates. | Idempotent per cancellation revision; audit actor/reason. Whether it breaks a streak is `DEC-003`. |
| `BOOKING_REFUNDED` | Refund becomes succeeded / policy-qualified reversal; source refund and booking. | Re-evaluate all awards, tiers, points, rewards derived from booking. | Key includes refund state/version. Never delete history; record reversal/revocation. |
| `REVIEW_PUBLISHED` | Reciprocal publication, expiry publication, or moderator restore; source review. | Super Reviewer; Traveler tier guest-review predicate. | Key is review + publication revision. Hide/delete emits a compensating evaluation. |
| `HOST_GUEST_RATING_PUBLISHED` | `REVIEW_PUBLISHED` where direction is host-to-guest; source review, target guest, booking/listing host. | 5-Star Streak; Perfect Guest; tier rating aggregate. | One rating source per review; rating/status changes reprocess the aggregate. |
| `REFERRAL_QUALIFIED` | Referred guest’s first approved, qualifying completed stay and fraud policy passed. | Referral ledger; Ambassador/Icon referral count. | Unique referred user + qualifying booking already aligns with current `ReferralReward`; move trigger out of dashboard read. |
| `REFERRAL_REVOKED` | Approved qualification later invalid due to reversal/fraud/admin decision. | Reverse referral points, update tier eligibility/history. | Must cite original qualified event and authorized reason. |
| `BADGE_AWARDED` | Achievement transaction committed. | Profile projection, notification, benefit issuer. | Unique user+definition+rule version; audit evidence snapshot. |
| `BADGE_REVOKED` | Policy-qualified source reversal or admin action. | Hide active projection; reverse unredeemed dependent benefit if policy permits. | Preserve award and revoke records; reason/actor mandatory. |
| `TIER_CHANGED` | Deterministic tier evaluator finds a current tier change. | Tier history, profile projection, tier benefit issuer. | Key is user + evaluation snapshot/version; no duplicate transition notification. |
| `REWARD_ISSUED` | Badge/tier/campaign/referral rule creates benefit/points entitlement. | Wallet/projection/notification. | Immutable reward/ledger ID, funding source and expiration snapshot. |
| `REWARD_REDEEMED` | Transactional reservation/commit succeeds. | Checkout/operational fulfilment and wallet. | Request idempotency key; locking/version check prevents concurrent spend. |
| `REWARD_REVERSED` | Cancellation, refund, expiry policy or admin correction. | Ledger/reward history/checkout correction. | References prior issue/redemption; append-only audit. |

## 3. Processing order and stale/out-of-order behavior

1. Persist source transition and outbox event atomically.
2. Process source evidence before derived rule evaluation. For a completed booking: normalize destination and visit evidence first, then achievements/stickers, then tier/referral calculations, then benefits.
3. Process each consumer under its own idempotency key. If an event arrives twice it produces no second award, points transaction, or notification.
4. Events may arrive late/out of order. Consumers load current authoritative source state and use event version/timestamp only for ordering; they do not trust stale payload values.
5. A later invalidation/reversal creates an explicit compensating event. It never destructively deletes award/ledger history.
6. Failure retries use the existing `BackgroundJob` lock, attempts, backoff and idempotency-key pattern. The in-memory fallback is not acceptable for monetary or entitlement processing.

## 4. Reconciliation and historical backfill

Reconciliation is a bounded, repeatable server process, not a profile page action. It:

- selects bookings/reviews/referrals by cursor and source updated-at watermark;
- emits or repairs missing source events with deterministic keys;
- recomputes derived active state from immutable evidence;
- writes a dry-run result before any production backfill;
- reports skipped records missing country/city, timestamps, timezone, payment/refund or fraud evidence;
- never awards from manual stamps, travel photos, current wallet literals or arbitrary profile data.

Historical award policies must use the rule version active at the approved program launch/backfill date. A definition change is applied forward only unless an admin-approved migration explicitly says otherwise.

## 5. Failure, audit, and notification contract

| Concern | Required behavior |
|---|---|
| Worker failure | Mark/retry job with error; event remains unconsumed. Alert after maximum attempts. |
| Award write conflict | Treat existing unique award/ledger row as successful idempotent completion after validating same evidence. |
| Notification failure | Do not roll back an award; retry a separately idempotent notification delivery. |
| Admin override | Requires actor, permission, reason, rule version, source links, before/after values and audit log. |
| Privacy | Worker can retain evidence privately; public projections include only display-safe active award/tier data. |
| Reversal after redemption | Financial/operational compensating action is only allowed by approved reward policy; otherwise flag for administration, do not mutate balance silently. |

## 6. Phase 2 contract acceptance criteria

- [ ] A transactionally persisted outbox/event envelope exists with unique deduplication keys.
- [ ] `STAY_COMPLETED` is emitted/reconciled from existing booking lifecycle without treating a raw end date as sufficient evidence.
- [ ] Consumers are idempotent and compensating reversals are append-only.
- [ ] The job worker supports retries, locks, observability and a non-memory production path.
- [ ] A dry-run historical reconciliation report exists before mutations.
- [ ] Event payloads never contain user-controlled achievement claims or public sensitive data.
