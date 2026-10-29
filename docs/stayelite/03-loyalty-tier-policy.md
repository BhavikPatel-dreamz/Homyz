# StayElite tier policy

**Status:** proposed v1.0. The three tiers and numeric thresholds are documented requirements; lifecycle and commercial choices called out below remain unapproved.

## 1. Eligibility snapshots

An evaluator builds a versioned eligibility snapshot from qualifying events, never from a UI balance:

| Metric | Definition |
|---|---|
| `completedStayCount` | Count of distinct booking IDs with a qualifying `STAY_COMPLETED` and no active disqualifying reversal. |
| `eligibleRatingCount` / `averageGuestRating` | Published host-to-guest reviews for qualifying completed bookings, one per booking; arithmetic mean unrounded. |
| `qualifiedReferralCount` | Distinct referred users with active `REFERRAL_QUALIFIED` events under the referral rule version. |
| `submittedGuestReviewCount` | Published guest-to-property review on a qualifying completed booking; Traveler requires at least one. |

| Tier | Required predicates (all true) | Current-state priority | Benefits to issue only through reward policy |
|---|---|---|---|
| Traveler | active registered guest; `completedStayCount >= 1`; `submittedGuestReviewCount >= 1` | lowest | seasonal-deal access |
| Ambassador | `completedStayCount >= 15`; `eligibleRatingCount >= 10`; `averageGuestRating >= 4.8`; `qualifiedReferralCount >= 5` | middle | 5% discount, VIP eligibility |
| Icon | `completedStayCount >= 25`; `eligibleRatingCount >= 10`; `averageGuestRating >= 4.8`; `qualifiedReferralCount >= 10` | highest | 10% discount, VIP eligibility, long-stay free-night eligibility |

Tier evaluation chooses the highest qualifying tier. A membership history records transition, source snapshot and rule version. Tier progress is a separate collection of criteria progress; it is not points and must not use the 5-Star Streak boost until `DEC-009` is approved.

## 2. Lifecycle and privacy

- **Evaluation triggers:** `STAY_COMPLETED`, host-rating publication/moderation, referral qualification/revocation, rule evaluation backfill, authorized admin correction.
- **No implicit expiry:** the brief does not define expiry, renewal or downgrade timing. Snapshot current eligibility on each event but do not auto-downgrade or withdraw consumed benefits before `DEC-008` approval.
- **Reversal:** source invalidation recalculates eligibility; record a proposed/actual tier change only under approved downgrade policy. Never overwrite history.
- **Display:** members can control whether a tier is public; the private owner view always shows current tier/progress. A hidden tier does not disable eligibility. Public profile never exposes referral/rating evidence.
- **VIP profile:** visibility is a presentation entitlement, not an identity-verification status.

## 3. Entitlement boundaries

| Benefit | Tier relationship | Issuance boundary |
|---|---|---|
| Seasonal deals | Traveler and higher only when campaign rule permits | Campaign eligibility check, not a blanket discount. |
| 5% / 10% | Ambassador/Icon current membership | Price adjustment only under approved stacking/funding/refund policy. |
| VIP marker | Ambassador/Icon | Public display if user elects visibility. |
| Free extra night | Icon plus a qualifying `nights >= 14` booking | Issue eligibility; pricing/host settlement requires approved fulfilment rules. |

## 4. Tier acceptance criteria

- [ ] Membership/history stores tier and definition version, evaluated evidence, timestamp and cause event.
- [ ] All Ambassador/Icon conditions are ANDed, including referral count and rating average/count.
- [ ] Rating source is host-to-guest published review, not guest-to-property listing review.
- [ ] Public visibility is independent of ownership and commercial entitlement.
- [ ] No automatic expiry/downgrade is deployed without `DEC-008` approval.
- [ ] Discount/free-night logic is not placed in tier evaluation or client UI.
