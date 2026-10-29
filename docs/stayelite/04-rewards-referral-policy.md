# StayElite rewards, points and referral policy

**Status:** proposed policy. Only Zero-Cancel Pro’s +300 points is fixed by the requirement; all other earning rates, commercial funding and expiry values remain unapproved.

## 1. Append-only point accounting

The existing wallet is demonstration UI and contributes no opening balance. Phase 2 requires an immutable points ledger, not a mutable `User.points` source of truth.

| Ledger class | Effect on balances | Examples |
|---|---|---|
| `PENDING_EARN` | pending only | referral awaiting admin/fraud review |
| `EARN` | pending decreases, available increases | approved referral, Zero-Cancel +300, authorized admin grant |
| `REDEEM_RESERVE` | available decreases/reserved increases | checkout redemption request |
| `REDEEM_COMMIT` | reserved decreases permanently | completed redemption |
| `REDEEM_RELEASE` | reserved decreases/available restores | expired or failed checkout |
| `EXPIRE` | available decreases | approved expiry policy |
| `REVERSE` | offsets the original credited/redeemed entry | refund/fraud/admin correction |

`available = earned + approved adjustments - committed redemptions - expirations +/- reversals - active reserves`. Balances are projections of transactions. Every transaction stores a unique idempotency key, source event, actor/reason, rule version and audit link. Concurrent redemption uses a transaction/row version or atomic conditional decrement; a user cannot spend the same points twice.

## 2. Documented benefit policy

| Benefit | Eligibility / issuance | Redemption and operations | Approval blocker |
|---|---|---|---|
| Seasonal deals | Traveler-or-higher active tier plus active campaign. | Applied only if campaign criteria and checkout pricing agree. | campaign rules, funding, stacking, expiry |
| Ambassador 5% / Icon 10% | Current tier at quote/reservation point. | One tier discount max; quote must snapshot rule/funding. | stacking, taxes/fees, host/platform funding, cancellation/refund |
| VIP profile | Tier eligibility and user public-display setting. | Display only; no checkout effect. | none beyond privacy policy |
| Icon free extra night | Icon + qualifying booking of `nights >= 14`. | Eligibility issues a non-price entitlement; fulfilment only after approved night-selection, cap, settlement and availability rules. | all commercial/host terms |
| Zero-Cancel bonus | Awarded once with `BADGE_ZERO_CANCEL_PRO_V1`. | Post exactly +300 after award transaction commits; reverse only under approved source reversal policy. | expiry policy |
| 5-Star progress boost | Awarded once with badge. | Store eligibility/progress adjustment proposal; never convert to points/discount. | exact 10% calculation |
| Super Reviewer status | Badge award. | Display verified-reviewer eligibility, not identity verification. | what downstream privilege if any |
| City upgrade option | City Collector award. | Request/claim only; host/inventory confirms actual upgrade. | benefit scope/expiry/funding |
| Late checkout option | Loyal Nomad award. | Request/claim only; listing availability/host confirms. | benefit scope/expiry/funding |

## 3. Referral qualification

1. **Attribution:** registration resolves a backend-issued referral code to one active inviter. Persist `referredById`; no client-supplied inviter ID.
2. **Conversion candidate:** a distinct referred user completes their first qualifying stay. The completion event, not dashboard viewing, creates the pending candidate.
3. **Minimum stay:** no minimum nights is supplied. The candidate is blocked on `DEC-007`; defaulting to one qualifying completed stay is a recommendation, not an approved commercial rule.
4. **Approval:** existing `ReferralReward` approval/rejection is reused as a review state. Approval creates `REFERRAL_QUALIFIED` and a points ledger credit only if program configuration authorizes a value.
5. **Uniqueness:** one referred user and one qualifying booking can produce one referral conversion. Existing unique relationships provide the starting constraint.
6. **Fraud/self-referral:** prohibit inviter = referred user; flag shared identity/payment/device/address signals according to approved privacy/fraud policy; admin decisions require reason/audit.
7. **Tier counting:** only active approved `REFERRAL_QUALIFIED` conversions count. A revoked/fraudulent/refunded conversion removes current eligibility on the next evaluator run and records history.
8. **Historical:** reconciliation creates candidates deterministically from eligible first stays, then routes them through the same approval/fraud checks; it never auto-credits fake historical points.

## 4. Reward lifecycle

`ISSUED → AVAILABLE → RESERVED → REDEEMED` with side exits `EXPIRED`, `REVERSED`, `CANCELLED`. Entitlements that require host availability use `ISSUED → REQUESTED → CONFIRMED/DECLINED/EXPIRED`; they are never represented as guaranteed checkout adjustments before confirmation.

## 5. Acceptance criteria

- [ ] No hardcoded wallet number or transaction is imported into a ledger.
- [ ] Ledger records are immutable, source-linked and idempotent.
- [ ] A referral cannot qualify merely because a dashboard was loaded.
- [ ] Referral/tier evaluation handles approval, rejection and reversal.
- [ ] Monetary benefits remain disabled until funding, stacking, pricing and refund decisions are approved.
- [ ] Upgrade and late checkout remain request-based pending host/availability confirmation.
