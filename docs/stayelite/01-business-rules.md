# StayElite business rules and eligibility catalog

**Status:** proposed specification v1.0 — no runtime behavior is activated by this document.  
**Source:** Phase 1 brief and [Phase 0 audit](../audits/phase-0-stayelite-loyalty-achievement-audit.md).  
**Scope:** all 30 documented definitions. `STAY_COMPLETED` means the authoritative completion event specified in [02-achievement-event-contracts.md](02-achievement-event-contracts.md), not merely a date comparison.

**Phase 0 correction:** the Phase 1 brief supplies previously unavailable behavioral thresholds. This catalog preserves them exactly: Early Bird `>= 30 days`, Last Minute Luck `<= 12 hours`, Loyal Wanderer `3` stays at the same listing, Group Pack `>= 4` guests, Perfect Guest `10` five-star ratings from different hosts, 10-Stay Veteran `10` completed stays, and Language Leaper `3` countries with different native languages. Missing implementation or source data is not treated as a missing requirement.

## 1. System boundaries

| Concept | Ownership and evidence | Guest controls | Reuse boundary |
|---|---|---|---|
| User-managed travel stamp | Manual declaration, selected catalog entry, or custom artwork. It is a personal memory, never verification evidence. | Create/edit/remove/pin/reorder/per-item visibility under existing permissions. | Retain `TravelStamp`, `UserTravelStamp`, stamp UI and privacy service. |
| Verified achievement sticker | System award based only on immutable booking/review/referral event evidence. | May hide public display if policy allows; may not create, edit, delete, or self-award. | Extend `TravelAchievement`/`UserTravelAchievement`; do not reuse editable stamp ownership as the award record. |
| Loyalty badge | A verified quality or behavioral achievement with progress and optional benefit/eligibility. | Same display rule as achievement stickers. | Represent as a typed achievement definition/category, not a second collection. |
| StayElite tier | Current evaluated membership plus immutable tier-change history. | Read-only; public visibility is separate from membership. | New membership/history layer referencing `User` and tier definition; no replacement Travel Profile. |

**Invariants:** all automatic awards are server evaluated; manual location/photo text never qualifies an award; one active award per user and definition/rule version; award evidence is immutable; revocation is an audited authorized action; a manually added stamp matching an award never creates, suppresses, or proves the award.

## 2. Shared eligibility conventions

1. **Qualifying stay:** confirmed reservation with one successfully completed stay event and no disqualifying reversal. A cancelled, declined, expired, failed-payment, or pre-completion refunded reservation is not qualifying.
2. **Historical evaluation:** evaluate eligible historical bookings through the same deterministic rules and event identity. Never manufacture an award from a profile stamp or UI state.
3. **One-time unlock:** each documented badge/sticker is awarded once per user. Its benefit may have its own issue/redeem policy.
4. **Recalculation:** a delayed event can award a missing achievement. A later cancellation/refund, moderation, or referral revocation re-evaluates affected definitions and can revoke a benefit/award only under the documented revocation policy.
5. **Evidence snapshot:** award records preserve definition version, source event IDs, calculation result, and evaluated timestamp; current rules never silently rewrite a past award.
6. **Progress:** `0..threshold`, capped for display, is calculated server-side from the same source query; it is not a wallet balance or tier percentage.

## 3. Rule-to-data-source mapping

| Source | Existing authoritative fields | Phase 2 dependency |
|---|---|---|
| Completed stay | `Booking.id`, user/listing IDs, status, start/end date; listing city/country; existing completed-confirmed helper | Durable `STAY_COMPLETED` record/outbox and completion timestamp. |
| Booking behavior | Booking creation timestamp, guest count, listing ID, start/end dates | Persist/derive `confirmedAt` and property timezone; define guest count semantics. |
| Host rating | `Review` where `direction=HOST_TO_GUEST`, `status=PUBLISHED`, `rating`, target guest/booking/listing | Stable event after publication/moderation; correct host identity via listing. |
| Guest review | `Review` where `authorId=guest`, `direction=GUEST_TO_PROPERTY`, `status=PUBLISHED`, comment | Approved high-quality predicate/version. |
| Destination | `Listing.country`, `Listing.city`, normalized `Destination`/`UserDestination` | Versioned taxonomy and booking-linked visit evidence. |
| Referral | `User.referredById`, `ReferralReward`, qualifying booking, approval state | Completion-driven qualification + fraud/revocation metadata. |

## 4. Tier definitions

All tier criteria use logical **AND**. Higher tier evaluation is attempted first; a qualifying Icon is not also assigned Ambassador as current membership, though history records every transition.

| ID | Eligibility | Benefit | Acceptance criteria |
|---|---|---|---|
| TIER_TRAVELER_V1 | Registered active guest **and** `completedStayCount >= 1` **and** at least one published guest-to-property review linked to a qualifying completed stay. | Seasonal-deal access entitlement. | All three predicates are evidenced; no deal is automatically priced until a campaign permits it. |
| TIER_AMBASSADOR_V1 | `completedStayCount >= 15` **and** at least 10 eligible published host-to-guest ratings with arithmetic mean `>= 4.8` **and** `qualifiedReferralCount >= 5`. | 5% tier benefit; VIP public-profile eligibility. | Meeting stay count alone fails; all source event IDs/version are captured. |
| TIER_ICON_V1 | `completedStayCount >= 25` **and** at least 10 eligible published host-to-guest ratings with mean `>= 4.8` **and** `qualifiedReferralCount >= 10`. | 10% tier benefit; VIP eligibility; long-stay extra-night eligibility. | All conditions are cumulative; free-night issuance also requires a qualifying 14+ night booking and approved fulfilment policy. |

Eligible rating calculation excludes hidden/deleted/moderated-out reviews and includes at most one published host-to-guest review per completed booking. Rating is the unrounded arithmetic mean; comparison is inclusive (`>= 4.8`). Rating changes/moderation trigger re-evaluation.

Tier expiry, downgrade timing and renewal are deliberately **not approved**. Until decision `DEC-008`, retain the last legitimate membership snapshot, calculate current eligibility, and do not issue a new monetary entitlement after a user ceases to qualify.

## 5. Quality badge definitions

| ID | Rule and calculation | Benefit / state | Acceptance criteria |
|---|---|---|---|
| BADGE_ZERO_CANCEL_PRO_V1 | Ten consecutive **confirmed booking outcomes** ordered by checkout instant, each resulting in `STAY_COMPLETED`, with no policy-in-scope cancellation in the sequence. Exact cancellation scope is `DEC-003`. | Issue exactly +300 pending/earned points via an immutable ledger transaction; one profile badge. | A unique sequence of 10 event IDs is stored; duplicate processing cannot post the bonus twice; cancellation/refund re-evaluates. |
| BADGE_FIVE_STAR_STREAK_V1 | Five consecutive eligible host-to-guest published ratings with `rating = 5`, ordered by effective publication time then review ID. Any eligible rating below 5 breaks the sequence. | Award badge; record a 10% next-tier-progress boost request, not a discount or points. | Streak source IDs and resulting progress proposal are stored; exact boost effect remains `DEC-009`. |
| BADGE_SUPER_REVIEWER_V1 | At least 15 eligible high-quality written guest-to-property reviews, one per qualifying booking. `highQualityReview` predicate requires approval in `DEC-005`. | Badge; verified-guest **eligibility status**, not identity verification. | Only published non-empty reviews passing the versioned predicate count; moderation re-evaluates. |
| BADGE_CITY_COLLECTOR_V1 | At least 10 distinct normalized `(countryCode, citySlug)` destinations from qualifying completed stays. Repeats increment visit history but not distinct count. | Badge and one upgrade-option entitlement. | Destination evidence is booking linked; manually entered destinations are excluded; upgrade remains host/availability subject. |
| BADGE_LOYAL_NOMAD_V1 | A run of three consecutive qualifying completed stays, each with `nights > 14` (strictly more than 14). “Consecutive” uses chronological qualifying booking outcomes; exact interruptions are `DEC-006`. | Badge and late-checkout-option entitlement. | Duration is calculated from normalized booking dates; no guaranteed checkout is implied. |

## 6. City-based verified stickers

Unlock condition for every city sticker: at least one qualifying completed stay at the canonical country/city pair. Booking-time wording is treated as **eligibility capture**; automatic award fires after completion (pending `DEC-002`). All are one-time awards and exclude user-managed stamps.

| ID | Display name | Canonical normalized destination | Aliases to normalize before comparison | Acceptance criteria |
|---|---|---|---|---|
| STICKER_PARISIAN_PULSE_V1 | Parisian Pulse | `FR / paris` | Paris, Paris City | Completed booking resolves to France/Paris; generated definition key is unique. |
| STICKER_LONDON_CALLING_V1 | London Calling | `GB / london` | London, Greater London | UK country code disambiguates other Londons. |
| STICKER_STATUE_SEEKER_V1 | Statue Seeker | `US / new-york` | New York, New York City, NYC | City alias map version is recorded. |
| STICKER_DESERT_DREAMS_V1 | Desert Dreams | `SA / riyadh` **OR** `AE / dubai` | Riyadh; Dubai, Dubai City | Either canonical destination grants the same single award. |
| STICKER_TOKYO_LIGHTS_V1 | Tokyo Lights | `JP / tokyo` | Tokyo, Tokyo Metropolis | Replace duplicate legacy static slug with this stable definition key; no data seeding/award in Phase 1. |
| STICKER_MIAMI_HEAT_V1 | Miami Heat | `US / miami` | Miami, City of Miami | Country required. |
| STICKER_GOLDEN_VIEW_V1 | Golden View | `US / san-francisco` | San Francisco, San Francisco City | Country required. |
| STICKER_VENEZIA_VIBES_V1 | Venezia Vibes | `IT / venice` | Venice, Venezia | Alias resolves only to Italy/Venice. |

## 7. Geographical sticker definitions

These rules require an admin-curated, versioned destination taxonomy. Free text, coordinates alone, photo captions and manually declared destinations are prohibited evidence. Except where a threshold is not documented, the proposed threshold is at least one qualifying stay at a destination carrying the relevant active taxonomy tag.

| ID | Required taxonomy and rule | Status / acceptance criteria |
|---|---|---|
| STICKER_BEACH_BUM_V1 | `destination.classification.BEACH = true`; one qualifying completed stay. | Proposed threshold; taxonomy/source approval required (`DEC-014`). |
| STICKER_MOUNTAIN_MOVER_V1 | `MOUNTAIN = true`; one qualifying completed stay. | Same taxonomy safeguard. |
| STICKER_CITY_LIGHTS_V1 | `MAJOR_METROPOLITAN = true`; one qualifying completed stay. | Same taxonomy safeguard. |
| STICKER_NATURE_NOMAD_V1 | `NATURE = true`; one qualifying completed stay. | Same taxonomy safeguard. |
| STICKER_CULTURAL_EXPLORER_V1 | `CULTURAL = true`; one qualifying completed stay. | Same taxonomy safeguard. |
| STICKER_CONTINENT_COLLECTOR_V1 | Count distinct `continentCode` values from qualifying completed stays. | Threshold is absent from the supplied requirements and is **BLOCKED** until approved; never infer it. |

## 8. Behavioral sticker definitions

For rules saying “book”, qualification is measured at `BOOKING_CONFIRMED`, but award occurs after that booking/stay has completed successfully. This prevents cancelled reservations creating permanent verified awards.

| ID | Documented threshold and proposed exact calculation | Acceptance criteria / dependency |
|---|---|---|
| STICKER_EARLY_BIRD_V1 | Booking confirmed at least **30 calendar days** before property-local check-in: `confirmedAt <= startDate@00:00(propertyTimezone) - 30 days`. | Requires durable `confirmedAt` and property timezone; cancelled/refunded stay never awards. |
| STICKER_LAST_MINUTE_LUCK_V1 | Booking confirmed within **12 elapsed hours** before property-local check-in: `0 <= checkInInstant - confirmedAt <= 12h`. | Requires durable `confirmedAt`, check-in time/timezone; exact boundary inclusive. |
| STICKER_LOYAL_WANDERER_V1 | Three distinct qualifying completed stays with the same immutable `listingId`; no consecutive condition. | Count bookings, not a title/address. Award after third completion. |
| STICKER_SEASON_HOPPER_V1 | At least one qualifying completed stay containing a local overnight date in each of Spring/Summer/Autumn/Winter for the listing’s configured season-region calendar. | Requires approved season/calendar mapping and listing timezone (`DEC-013`). |
| STICKER_GROUP_PACK_V1 | A qualifying completed stay with `Booking.guests >= 4`; the field is the reservation’s total guests as stored. | Infants/pets/host-added guests semantics require field-contract confirmation. |
| STICKER_PERFECT_GUEST_V1 | Ten distinct hosts each provide an eligible published host-to-guest `rating = 5` for a qualifying completed booking. | Deduplicate by host user ID, not reviews/listings; rating removal re-evaluates. |
| STICKER_TEN_STAY_VETERAN_V1 | `completedStayCount >= 10`. | Each booking counted once after completion; award once. |
| STICKER_LANGUAGE_LEAPER_V1 | Qualifying completed stays in at least three distinct countries with pairwise different selected native/primary language codes from a versioned country-language dataset. | Country-language source and multi-language selection are blocked by `DEC-015`; manual stamps excluded. |

## 9. Universal definition acceptance checklist

Every definition is implementable only when it has: a stable definition key/version; active/published lifecycle; rule schema validation; source data contract; deterministic comparison and timezone behavior; award idempotency key; progress query; display/privacy policy; benefit policy if any; revocation/reconciliation behavior; admin audit trail; and automated happy-path, duplicate, reversal, authorization and historical-replay tests.
