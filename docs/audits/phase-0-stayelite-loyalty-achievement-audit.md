# HOMYZ Phase 0 — StayElite, Achievement, Travel Sticker & Admin Audit

**Audit date:** 2026-10-28  
**Mode:** read-only repository audit. No application source, Prisma schema, migration, route, or production data was changed.  
**Requirement source:** the supplied Phase 0 brief. The referenced `Loyalty Program_ “StayElite”(2).docx` was not present in the supplied attachments or repository, so the 30 definitions transcribed in the brief are the traceable source of truth for this audit.

## Evidence and verification method

- Inspected the App Router routes, Prisma schema/migrations, travel, booking, review, referral, notification, admin, pricing, and background-job services.
- Ran `npx tsc --noEmit --pretty false`: **passed**.
- Ran `npx tsx --test __tests__/phase5-public-travel-profile-privacy-sharing.test.ts`: **10/10 passed**.
- Did not run database-backed E2E tests because they create and delete records, contrary to the Phase 0 no-data-change rule.
- `__tests__/guest-referral-flow.test.ts` was attempted and failed before runtime behavior checks on a brittle string assertion looking for a spacing-specific schema snippet. The actual unique constraint is present at [schema.prisma:425](../../prisma/schema.prisma#L425); this is test-maintenance debt, not evidence that referral uniqueness is absent.

Status definitions follow the brief. `PARTIALLY_IMPLEMENTED` means that an authoritative data source or reusable domain component exists, but the documented requirement is not operating end-to-end.

---

## Report A — Existing implementation inventory

| Subsystem | Existing files / routes | Status | Working features | Gaps | Action |
|---|---|---|---|---|---|
| Travel Profile | [travel-profile/page.tsx](../../app/(protected)/travel-profile/page.tsx), [public-travel-profile.service.ts](../../services/public-travel-profile.service.ts#L31), `/travelers/[handle]` | IMPLEMENTED_VERIFIED | Owner profile, opaque public IDs, profile/trip/photo privacy, follows/blocks, public DTO projection and paginated owner photos/stamps. | No loyalty tier or verified-achievement presentation. | REUSE_WITH_FIX |
| Travel photos/trips | [travel-photo.service.ts](../../services/travel-photo.service.ts), `TravelTrip`/`TravelPhoto` in [schema.prisma](../../prisma/schema.prisma#L2791) | IMPLEMENTED_VERIFIED | Persisted albums, uploads, covers, visibility, likes/comments, safe media access. | Photo location is user-entered and cannot qualify an achievement. Legacy `TripPhoto` remains alongside `TravelPhoto`. | REUSE_WITH_FIX; consolidate legacy reads deliberately. |
| Destination verification | [travel-destination.service.ts](../../services/travel-destination.service.ts#L185), [travel-reconciliation.service.ts](../../services/travel-reconciliation.service.ts#L20) | PARTIALLY_IMPLEMENTED | Derives normalized country/city from confirmed completed bookings; idempotently writes `UserDestination`. | Owner-triggered reconciliation only; no lifecycle/outbox trigger; no per-visit evidence or continent/property taxonomy. | EXTEND_EXISTING |
| User-managed stamps | [travel-stamp.service.ts](../../services/travel-stamp.service.ts#L1183), [travel-stamps-section.tsx](../../components/travel/travel-stamps-section.tsx) | IMPLEMENTED_VERIFIED | Manual, user-selected, and custom stamps; per-stamp visibility/pin/order; owner authorization; public filtering. | User-selected catalog stamps look like earned stamps; removal and visibility changes also apply to future verified stamps. | REUSE_WITH_FIX |
| Verified stamp award prototype | [travel-stamp.service.ts](../../services/travel-stamp.service.ts#L321) | PARTIALLY_IMPLEMENTED | Rules can evaluate completed stays, verified countries, and curated cities; unique ownership absorbs concurrent duplicate inserts. | No call site; reconciliation explicitly returns `awardedStampsCount: 0`; historical auto-awarded rows were removed by [20261028090000 migration](../../prisma/migrations/20261028090000_remove_automatic_travel_collection_artifacts/migration.sql). | EXTEND_EXISTING |
| Achievement engine | `TravelAchievement`, `UserTravelAchievement` in [schema.prisma](../../prisma/schema.prisma#L3033) | PARTIALLY_IMPLEMENTED | Persistent definition, progress, status, award timestamp and per-user uniqueness exist. | No services, routes, admin UI, catalog seed, event processor, public display, revocation, or activity history uses these models. | EXTEND_EXISTING |
| Loyalty wallet | [loyalty-wallet-view.tsx](../../components/profile/loyalty-wallet-view.tsx#L17) | BROKEN | Presentation is available. | Balance, transactions, rewards, tier and redemption are literal client state; nothing persists, authorizes, prices, or fulfils a reward. | BUILD_NEW; hide or label non-production until replaced. |
| Referral rewards | [referral.service.ts](../../services/referral.service.ts#L82), `/api/v1/referrals/me`, `/admin/referrals` | PARTIALLY_IMPLEMENTED | Backend-generated referral code, signup attribution, one pending record per referred user/qualifying booking, admin approval/rejection, audit entry and notification. | Qualification is evaluated only when inviter opens dashboard, uses `endDate <= now` rather than checkout time, and approved “points” never enter a points ledger. No StayElite qualifying-referral counters. | EXTEND_EXISTING |
| Booking/review source data | [Booking](../../prisma/schema.prisma#L1140), [Review](../../prisma/schema.prisma#L1501), [booking-status.ts](../../lib/booking/booking-status.ts#L59), [review.service.ts](../../services/review.service.ts#L506) | IMPLEMENTED_UNVERIFIED | Booking dates, guest count, status, listing, reviews, reciprocal host-to-guest ratings and review publication exist; completion is derived from confirmed checkout. | No persisted completion event/status; no achievement event emission; completion can be re-evaluated by time. | EXTEND_EXISTING |
| Admin stamp catalog | `/admin/travel-stamps`, [admin-travel-stamps-client.tsx](../../components/admin/travel-stamps/admin-travel-stamps-client.tsx), [actions/admin/travelStamps.ts](../../actions/admin/travelStamps.ts) | PARTIALLY_IMPLEMENTED | Admin-only create/edit/upload/search/activate/archive/delete; deletion safely archives collected catalog records. | No granular permission, rule/threshold editor, rule validation, award/revoke, definition versioning or audit record. | EXTEND_EXISTING |
| Admin loyalty/reward/campaign | Admin navigation and RBAC in [permissions.ts](../../lib/permissions/permissions.ts) | MISSING | Existing RBAC, audit-log service and settings patterns are reusable. | No tiers, reward catalog, redemptions, campaign, adjustment, rule-version or loyalty-eligibility pages/routes. | BUILD_NEW |
| Notifications/jobs | [notification.service.ts](../../services/notification.service.ts#L141), [job-queue.service.ts](../../services/job-queue.service.ts) | PARTIALLY_IMPLEMENTED | Per-user notification de-duplication by entity; durable job table has keys/retries/locks; referral approval notifies inviter. | No achievement/tier/reward job type or transactional outbox; notification write is outside referral approval transaction. | EXTEND_EXISTING |

### Travel stamp distinction and evidence

**A. User-managed memories are real and intentionally editable.** `createManualTravelStamp` creates an `UNVERIFIED` `UserDestination` with `MANUAL_DECLARATION` ([travel-stamp.service.ts:1183](../../services/travel-stamp.service.ts#L1183)); custom stamps are owned by the user. Users can also select active admin catalog entries directly ([travel-stamp.service.ts:901](../../services/travel-stamp.service.ts#L901)).

**B. Verified achievements cannot yet be trusted as a separate product class.** The prospective awarder uses booking-derived data ([travel-stamp.service.ts:321](../../services/travel-stamp.service.ts#L321)), but is not invoked. More importantly, `removeTravelStamp` deletes any owned `UserTravelStamp` without checking its evidence source ([travel-stamp.service.ts:1286](../../services/travel-stamp.service.ts#L1286)); `setStampPublic` and pin/reorder have the same mixed collection. Therefore system-earned awards cannot be protected from owner edits/deletion.

The migration [20261028090000](../../prisma/migrations/20261028090000_remove_automatic_travel_collection_artifacts/migration.sql) deliberately deletes legacy auto-award rows identified by `evidenceMetadata.rule`; this prevents every new user receiving catalog artifacts, but proves automatic awards were intentionally disabled rather than finished.

---

## Report B — StayElite requirement coverage matrix

Supporting source abbreviations: **B** = `Booking` + completed-confirmed helper; **R** = `Review`; **D** = `Destination`/`UserDestination`; **S** = `TravelStamp`; **A** = `TravelAchievement`; **RR** = referral reward. No row is counted as implemented unless the documented unlock and benefit are both operational.

| ID | Document requirement and benefit | Status | Supporting evidence | Issue / recommended primary phase |
|---|---|---|---|---|
| T1 | **Traveler:** signup + one completed stay + review; seasonal deals. | PARTIALLY_IMPLEMENTED | Signup exists; B/R can be queried. | No tier definition/membership or seasonal-deal entitlement. **P5** |
| T2 | **Ambassador:** 15+ stays, 4.8 across 10+ reviews, five qualifying referrals; 5% discount and VIP profile. | PARTIALLY_IMPLEMENTED | B/R/RR source records exist. | No cumulative evaluator, qualifying-referral definition, discount entitlement or VIP display. **P5** |
| T3 | **Icon:** 25+ stays, 4.8 across 10+ reviews, ten qualifying referrals; 10%, VIP, free night on 14+ day stays. | PARTIALLY_IMPLEMENTED | B/R/RR dates and rating fields exist. | No tier evaluator; no long-stay/free-night fulfilment/pricing rule. **P5** |
| Q1 | **Zero-Cancel Pro:** 10 consecutive bookings without cancellations; +300 points/profile badge. | PARTIALLY_IMPLEMENTED | B has status/time; A can hold progress. | No booking sequence/cancellation policy, points ledger or profile badge. **P4** |
| Q2 | **5-Star Streak:** 5 consecutive five-star host ratings; 10% next-tier progress boost. | PARTIALLY_IMPLEMENTED | Host-to-guest R has rating/direction. | No streak query, definition of eligibility/publication, or progress multiplier model. **P4** |
| Q3 | **Super Reviewer:** 15 high-quality written reviews; verified guest eligibility. | PARTIALLY_IMPLEMENTED | Guest-authored R records/comment exist. | “High-quality” and verified-guest consequence undefined; no rule or award. **P4** |
| Q4 | **City Collector:** 10+ different cities; next-booking upgrade eligibility. | PARTIALLY_IMPLEMENTED | D preserves normalized cities; B/listing city exists. | No award rule or fulfilment reservation entitlement. **P4** |
| Q5 | **Loyal Nomad:** 3 consecutive bookings each >14 days; late-checkout eligibility. | PARTIALLY_IMPLEMENTED | B start/end dates support duration. | Consecutive semantics and availability/host approval fulfilment not defined. **P4** |
| C1 | **Parisian Pulse:** Paris. | PARTIALLY_IMPLEMENTED | Static catalog has Paris/city mapping; D supports verified city. | Different display name; static catalog is not seeded and awarder is unused. **P3** |
| C2 | **London Calling:** London. | PARTIALLY_IMPLEMENTED | Static catalog definition and D city data. | Not guaranteed in DB; no lifecycle trigger. **P3** |
| C3 | **Statue Seeker:** New York. | PARTIALLY_IMPLEMENTED | Static catalog definition and D city data. | Not guaranteed in DB; no lifecycle trigger. **P3** |
| C4 | **Desert Dreams:** Riyadh or Dubai. | PARTIALLY_IMPLEMENTED | Riyadh/Dubai static definitions, D city data. | Must define whether either city grants one immutable award; no lifecycle trigger. **P3** |
| C5 | **Tokyo Lights:** Tokyo. | PARTIALLY_IMPLEMENTED | Static definition and D city data. | Duplicate `stamp-tokyo-lights` slug appears twice in the static array; static catalog is disabled. **P3** |
| C6 | **Miami Heat:** Miami. | PARTIALLY_IMPLEMENTED | Static definition and D city data. | Not guaranteed in DB; no lifecycle trigger. **P3** |
| C7 | **Golden View:** San Francisco. | PARTIALLY_IMPLEMENTED | Static definition and D city data. | Not guaranteed in DB; no lifecycle trigger. **P3** |
| C8 | **Venezia Vibes:** Venice. | PARTIALLY_IMPLEMENTED | Static definition and D city data. | Not guaranteed in DB; no lifecycle trigger. **P3** |
| G1 | **Beach Bum:** verified beach destination. | MISSING | Country/city coordinates exist. | No verified beach taxonomy/classification. **P3** |
| G2 | **Mountain Mover:** verified mountain destination. | MISSING | Country/city coordinates exist. | No verified mountain taxonomy/classification. **P3** |
| G3 | **City Lights:** city classification. | MISSING | City strings exist. | No stable destination/property theme taxonomy. **P3** |
| G4 | **Nature Nomad:** nature classification. | MISSING | City/country data only. | No nature classification. **P3** |
| G5 | **Cultural Explorer:** cultural classification. | MISSING | City/country data only. | No cultural classification. **P3** |
| G6 | **Continent Collector:** continent threshold. | MISSING | ISO country codes available. | No country-to-continent source/version. **P3** |
| B1 | **Early Bird:** booking lead-time behavior. | PARTIALLY_IMPLEMENTED | B created/start dates exist. | Exact window/timezone and award rule absent. **P4** |
| B2 | **Last Minute Luck:** short booking lead-time behavior. | PARTIALLY_IMPLEMENTED | B created/start dates exist. | Exact window/timezone and award rule absent. **P4** |
| B3 | **Loyal Wanderer:** repeated/unique-listing behavior. | PARTIALLY_IMPLEMENTED | B listing IDs and dates exist. | Threshold and ordering rule absent. **P4** |
| B4 | **Season Hopper:** stays across seasons. | PARTIALLY_IMPLEMENTED | B dates and listing location exist. | Season/calendar/timezone policy absent. **P4** |
| B5 | **Group Pack:** guest-count behavior. | PARTIALLY_IMPLEMENTED | B has `guests`. | Threshold and whether infants/pets count absent. **P4** |
| B6 | **Perfect Guest:** host-rating behavior. | PARTIALLY_IMPLEMENTED | Host-to-guest R exists. | Rating threshold/number of stays/published state absent. **P4** |
| B7 | **10-Stay Veteran:** completed-stay count. | PARTIALLY_IMPLEMENTED | Completed confirmed B can be counted. | No engine, award, or profile exposure. **P4** |
| B8 | **Language Leaper:** country/language behavior. | MISSING | Country code exists. | No authoritative country-language mapping or documented qualification rule. **P3** |

**Matrix total: 30.** Verified implemented: **0**; partially implemented: **23**; missing: **7**; broken: **0**; duplicated: **0**; unverified: **0**. Completion is therefore **0% end-to-end** by the brief’s standard, despite substantial reusable foundations.

### Benefits accounted for

| Benefit | Current support | Finding |
|---|---|---|
| Seasonal deals | No entitlement/campaign model | MISSING |
| 5% / 10% discounts | Existing pricing has selected non-loyalty discounts; no tier discount entitlement or stacking policy | MISSING |
| VIP profile | Travel/public profile exists, no tier field or badge selection | MISSING |
| Free extra night | Booking has price breakdown, no reward/free-night adjustment | MISSING |
| +300 points | No points ledger | MISSING |
| 10% tier-progress boost | No progress calculation/versioned rule | MISSING |
| Verified guest eligibility | Review and identity data exist, no eligibility model | MISSING |
| Upgrade/late checkout | No entitlement, availability reservation, or host fulfilment workflow | MISSING |

---

## Report C — Database & API gap analysis

### Reusable models and APIs

| Area | Existing model/API | Reuse decision | Required future extension / risk |
|---|---|---|---|
| Traveler identity/privacy | `TravelProfile`, `TravelFollow`, `UserBlock`; `/travelers/[handle]` | REUSE_AS_IS | Add only public achievement projection, never private audit evidence. |
| Booking evidence | `Booking`, `Listing`, `Review`, `BookingPayment`, `BookingRefund` | REUSE_WITH_FIX | Create a durable domain completion event. Do not interpret `endDate` alone as a persisted completed state. |
| Destination evidence | `Destination`, `UserDestination` | EXTEND_EXISTING | Add a per-booking visit/evidence table or event ledger before cumulative/consecutive rules; current uniqueness collapses repeated stays and does not increment `visitCount` on a repeat visit. |
| Stamps | `TravelStamp`, `UserTravelStamp` | EXTEND_EXISTING | Separate `USER_MANAGED` from `SYSTEM_AWARDED` ownership/visibility/edit policy in typed columns, not JSON metadata. |
| Achievements | `TravelAchievement`, `UserTravelAchievement` | EXTEND_EXISTING | Add rule version, display visibility, immutable award provenance, revocation state/reason, definition lifecycle and award event identity. |
| Referrals | `User.referredById`, `ReferralReward`, `/api/v1/referrals/me` | EXTEND_EXISTING | Use completion event; add qualifying conversion counter and points-ledger posting. Existing uniqueness helps prevent duplicate first-stay awards. |
| Notifications | `Notification`, notification service | REUSE_WITH_FIX | Introduce immutable event/outbox key and achievement/reward types; a find-then-create dedupe has no DB unique constraint. |
| Jobs | `BackgroundJob` / job queue | EXTEND_EXISTING | Add enum-backed achievement event/reconciliation jobs and handlers; do not rely on in-memory fallback for monetary benefits. |
| Admin authorization/audit | RBAC, `AuditLog`, guarded routes | REUSE_AS_IS | Use granular loyalty/stamp permissions, not only `Role.ADMIN`. |
| Pricing | booking price breakdown and payment/refund models | EXTEND_EXISTING | Make reward/tier benefits first-class signed pricing adjustments with funding source, reversal policy, and idempotency. |

### Migration risks

1. **P0:** migrating point balances from the current wallet UI would invent data because its `2450` balance and transactions are literals ([loyalty-wallet-view.tsx:17](../../components/profile/loyalty-wallet-view.tsx#L17)). Do not backfill it.
2. **P1:** the 20261028090000 migration deliberately removed rows whose `evidenceMetadata.rule` marked old automatic awards. Re-introducing awards must use an explicit evidence/audit model; never infer them from manual/catalog collection rows.
3. **P1:** `UserTravelStamp` has one row per user/stamp and no immutable event reference. Altering it in place without a data classification/migration plan could turn editable memories into purportedly verified awards.
4. **P1:** city catalog constants are not database seed data (`ensureStampCatalog` is an intentional no-op), so a migration must be idempotent, versioned, and reviewed—not silently seed or assign existing users.
5. **P2:** `TravelStamp.category` is schema string despite an enum being declared elsewhere; admin create/update does not set `eligibilityRule` or `ruleThreshold`, so default `COMPLETED_STAYS/1` may be semantically wrong for city definitions.

---

## Report D — Reuse versus build decision

| Capability | Decision | Rationale |
|---|---|---|
| Travel profile, follows/blocks, photos/trips, media ACL | REUSE_AS_IS | Verified privacy boundaries and public DTO behavior exist. |
| Destination normalization and completed-stay query | REUSE_WITH_FIX | Good source normalization and confirmed checkout helper; needs system-triggered, per-visit event evidence. |
| Manual/custom stamp tools | REUSE_AS_IS | They correctly represent self-declared memories and have owner checks. |
| Shared stamp collection table/UI | REUSE_WITH_FIX | Reuse display components, but prevent user mutation of system awards and visually distinguish trusted achievements. |
| Travel achievement definition/progress tables | EXTEND_EXISTING | Base relations/uniqueness exist; engine and audit/version/visibility layers do not. |
| Static city definitions | CONSOLIDATE_DUPLICATES | Map them to one admin-managed definition set; resolve duplicate Tokyo slug and marketing-name/city mapping. |
| StayElite tier engine | BUILD_NEW | No tier/membership/qualification model exists. |
| Points, rewards, redemption and fulfilment | BUILD_NEW | Current wallet is non-persistent client demo state. |
| Referral identity and approval queue | EXTEND_EXISTING | Strong attribution/uniqueness/admin-review base; not a ledger or conversion engine. |
| Admin stamps | EXTEND_EXISTING | CRUD/upload/archive are present; rule authoring/award/revoke/version/audit missing. |
| Admin tiers, rewards and campaigns | BUILD_NEW | No pages, API, model or permissions exist. |
| Fulfilment policy (discount, upgrade, late checkout, free night) | DEFER_PENDING_SPECIFICATION | Monetary and host-operational behavior must be approved before code. |

---

## Report E — Risks and blockers

| Severity | Finding | Evidence / impact | Proposed primary phase |
|---|---|---|---|
| P0 | Loyalty UI can appear to spend/credit money-like value locally. | `confirmRedeem` mutates only React state at [loyalty-wallet-view.tsx:103](../../components/profile/loyalty-wallet-view.tsx#L103); refresh loses it and checkout never sees it. | P6 |
| P0 | No authoritative reward pricing/reversal model. | No points/reward/redemption schema; discounts/free nights/late checkout cannot be safely promised or reversed on refund/cancel. | P7 |
| P1 | Trusted awards cannot be protected from user deletion/hiding/reorder. | `removeTravelStamp` only checks owner/id ([travel-stamp.service.ts:1286](../../services/travel-stamp.service.ts#L1286)). | P2 |
| P1 | Automatic stamp evaluator is dead code; reconciliation explicitly awards zero. | [travel-stamp.service.ts:321](../../services/travel-stamp.service.ts#L321), [travel-reconciliation.service.ts:30](../../services/travel-reconciliation.service.ts#L30). | P2 |
| P1 | Referral award creation is dashboard-read triggered rather than booking lifecycle triggered. | `issueEligibleRewards` runs from `getDashboard` ([referral.service.ts:129](../../services/referral.service.ts#L129)). Eligible referrals may remain absent until a visit. | P8 |
| P1 | Completion is derived from current time; no durable event/outbox protects ordering or reconciliation. | [booking-status.ts:59](../../lib/booking/booking-status.ts#L59); job enum has no achievement event. | P2 |
| P1 | Manual/city catalog collection can be mistaken for verified achievement. | Active catalog selection is user-driven; public profile exposes `isManual` but no system-earned type. | P2 |
| P2 | Geographic/thematic and language rules lack authoritative taxonomy. | No continent, destination-theme, country-language or listing classification evidence. | P3 |
| P2 | Tier/quality requirement policies are underspecified. | Cancellation attribution, high-quality reviews, consecutive semantics, referral qualification, downgrade/expiry and stacking are absent. | P1 |
| P2 | Admin catalog cannot configure unlock rules and no admin activity/audit exists for stamps. | Create/update only fields shown in [travel-stamp.service.ts:1412](../../services/travel-stamp.service.ts#L1412). | P9 |
| P2 | Notification dedupe is application-level find-then-create, not transactional with awards. | [notification.service.ts:141](../../services/notification.service.ts#L141). | P12 |
| P3 | Static catalog contains duplicate `stamp-tokyo-lights` slug. | [travel-stamp.service.ts:158](../../services/travel-stamp.service.ts#L158) and [189](../../services/travel-stamp.service.ts#L189). | P3 |
| P3 | Referral audit test is whitespace fragile. | `guest-referral-flow.test.ts` expects exact aligned text rather than schema semantics. | P15 |
| P3 | Legacy `TripPhoto` and current `TravelPhoto` coexist. | Both models exist in schema; audit should precede any travel-profile metrics expansion. | P14 |

---

## Report F — Phase 1–15 dependency map

Every confirmed implementation gap is assigned one primary phase below; later phases depend on it rather than reimplement it.

| Phase | Primary work | Depends on |
|---|---|---|
| P1 | Approve the missing business rules: qualifying completed stay, cancellation attribution, high-quality review, streak/consecutive ordering, seasonal/timezone, tier downgrade/expiry, benefit stacking, free-night and host fulfilment. | Product/legal/operations decision. |
| P2 | Achievement event/outbox foundation; immutable verified-award ownership/provenance; booking-completion reconciliation and idempotency. | P1 |
| P3 | Versioned destination taxonomy and all 14 city/geographic/language sticker definitions; resolve static catalog duplicates. | P1, P2 |
| P4 | Quality and behavioral achievement evaluators (Q1–Q5, B1–B7), review/booking evidence adapters, progress calculations. | P1, P2 |
| P5 | StayElite Traveler/Ambassador/Icon membership, cumulative qualification, status history and profile projection. | P1, P2, P4, P8 |
| P6 | Immutable points ledger, reward catalog, balances, redemption reservation and replacement of demo wallet. | P1, P2 |
| P7 | Checkout/price-adjustment and operational fulfilment for discounts, free nights, upgrades and late checkout; cancellations/refunds reversals. | P1, P6 |
| P8 | Referral conversion evaluator using completion events, qualifying-referral metrics and points posting/reversal. | P1, P2, P6 |
| P9 | Admin definition management for achievements/stickers/tiers/rules, rule validation and publish/archive. | P2, P3, P5 |
| P10 | Admin award/revoke/adjustment, campaign management, eligibility search and immutable admin activity views. | P5, P6, P8, P9 |
| P11 | Public/private achievement display, featured selection, counts and owner controls using the new trusted-award policy. | P2, P5, P9 |
| P12 | Async notifications for unlock/promotion/reward expiry/adjustment backed by outbox/job idempotency. | P2, P6, P8, P10 |
| P13 | Controlled historical backfill/reconciliation, dry-run/reporting, migration rollout and rollback plan. | P2–P12 as applicable |
| P14 | Performance/security hardening: indexes, pagination, cache invalidation, fraud controls, legacy photo consolidation audit. | P2–P13 |
| P15 | End-to-end, concurrency, authorization, pricing/reversal, migration and accessibility QA; replace brittle source-string tests. | P1–P14 |

---

## Report G — specification decisions needed

| Decision required | Options | Recommended production approach |
|---|---|---|
| What counts as completed? | Checkout time; explicit guest/host checkout; payment settlement; no open dispute. | Use an immutable `STAY_COMPLETED` domain event after configured checkout plus defined exception/refund/dispute handling; retain source snapshot. |
| City wording conflict | “Book a stay” vs automatic only after completed stay. | Award only after the defined completed event. Treat booking-time UI as progress, not unlock. |
| Cancellation streak | Any cancellation; guest-only; host/platform fault exclusions; cancelled pending requests. | Count only confirmed stays whose outcome is policy-qualified; persist reason/source and document retroactive correction. |
| Rating rules | Host-to-guest or guest-to-host? published or submitted? average/streak tie policy? | Use published host-to-guest reviews for guest-quality badges; define ties/hidden/deleted-review recalculation. |
| “High-quality” review | Minimum length; meaningful content; moderation status; manual review. | Start with published guest review, minimum normalized text length and no moderation restriction; version the policy. |
| Consecutive | Calendar order; no cancelled bookings between; same guest/local timezone. | Define ordered completed stays by checkout timestamp and explicit breakers; test simultaneous/out-of-order bookings. |
| Referral conversion | First completed stay versus documented stay requirement, self/household/fraud checks. | Retain one referred user → one qualifying completion, add fraud/identity exclusions and clear approval state. |
| Tier lifecycle | Permanent; rolling window; annual review; downgrade grace period. | Choose an evaluation window and snapshot memberships; do not silently infer it. |
| Benefit stacking/funding | Stack promo/tier/reward; host/platform split; taxes/fees; limits. | Require a benefit policy and signed price-adjustment model before checkout integration. |
| Free extra night | Cheapest night; cap; date eligibility; taxes/fees; host consent. | Treat as a voucher with eligibility, reservation and settlement rules, never a raw negative price. |
| Upgrade/late checkout | Guaranteed vs request; property availability; host approval. | Model as an entitlement request that checks listing availability and records host/operations fulfilment. |
| Geography | External dataset, admin curation, listing tags, coordinates. | Use versioned admin-curated destination taxonomy with a source reference; never infer beach/mountain/culture from free text. |
| Visibility/revocation | Can earned badges be hidden? Can user delete them? | User may hide display if policy permits, but cannot edit/delete award record; revocation is admin/system with reason/audit. |

---

## Report H — executive summary

HOMYZ has a strong reusable travel-social foundation: a privacy-aware public Travel Profile, user-managed stamps, normalized booking-derived destinations, booking/review data, admin stamp CRUD, RBAC/audit patterns, referrals, notifications, and a durable job-table abstraction. The Phase 0 static privacy suite passed all 10 checks and TypeScript is clean.

The requested StayElite program is **not yet implemented end-to-end**. Of the 30 documented tier/badge/sticker definitions, **0 are verified as operational**, **23 have partial reusable foundations**, and **7 are missing due to absent taxonomy/language support**. The largest risk is the client-only wallet, followed by the lack of an immutable achievement event/ledger and the inability to protect system awards from user deletion.

**Critical reusable components:** `Booking`/`Review`, `Destination`/`UserDestination`, `TravelAchievement`/`UserTravelAchievement`, `TravelProfile` privacy, `TravelStamp` administration, `ReferralReward`, `BackgroundJob`, RBAC, and `AuditLog`.

**Decision: BLOCKED for Phase 1 implementation until the Report G policy choices are approved.** Once those choices are confirmed, the recommended next action is **P1 specification approval**, followed by P2’s event/award foundation. No Phase 1 work was started in this audit.
