# StayElite guest experience specification

**Status:** proposed integration specification. Existing `/travel-profile`, `/travelers/[handle]`, stamp gallery, referral page, notification center and profile shell are reused; no duplicate public profile or stamp gallery is introduced.

## 1. Surface map

| Surface | Owner view | Public visitor view | Source of truth |
|---|---|---|---|
| Travel Profile | Existing photos/trips/user-managed stamps; add recognition module for tier, featured verified awards and progress. | Show only public tier/verified awards explicitly visible to public. | loyalty projection + existing privacy policy |
| Existing stamp gallery | Continue current personal/catalog/custom stamp controls. Label self-managed/verified status clearly. | Existing per-stamp visibility filtering. | current stamp data, never achievement engine |
| Guest dashboard | Tier card, next-tier criteria, locked/in-progress/earned achievements, reward status. | none | server projection |
| Booking checkout | Show only valid issued/redeemable monetary benefits. Upgrade/late checkout are requests, never guaranteed. | none | reward eligibility/reservation service |
| Referral page | Existing referral link/activity; add conversion state and pending/approved/revoked reward messages. | none | referral ledger/projection |
| Loyalty wallet | Replace current hardcoded balance/rewards with available/pending/reserved history when ledger exists. | none | immutable points/reward projection |
| Notification center | Achievement/tier/reward/referral notifications link to safe owner context. | none | idempotent notification delivery |

## 2. Required states and behavior

| State | Owner experience | Public exposure |
|---|---|---|
| Locked badge | Name/description and progress only when rule allows disclosure; no claim button. | Never show. |
| In-progress badge | Server-calculated `current/threshold`, last evaluated time and privacy-safe explanation. | Never show. |
| Earned badge | Date, definition version/display, benefit state and hide control. | Show only if badge’s public toggle and profile privacy allow it. |
| Hidden earned badge | Remains owned and counted privately; label visible to owner. | Omitted from public count/gallery. |
| Revoked achievement | Owner sees reason category and support/appeal route where allowed; never silently disappears. | Omitted unless product/legal policy requires otherwise. |
| Pending verification | Shows that event is awaiting completion/review/approval, never as earned. | Never show. |
| Available / used / expired reward | Wallet shows immutable lifecycle, terms and safe redemption CTA. | Never show. |
| Current tier / next tier progress | Shows all AND criteria independently; do not collapse into a misleading single percentage. | Tier only if owner enables visibility; no qualification details. |

## 3. Interaction and synchronization rules

- Visual language follows the existing Instagram-style Travel Profile but places verified recognition in a clearly labelled section, not inside the editable stamp manager.
- User-managed stamps retain remove/edit/pin/privacy actions. Verified awards show no client award/edit/delete control.
- Feature selection/pinning applies only to public display projection and is bounded/owner authorized; it cannot change eligibility or award date.
- Mutations trigger server cache/path invalidation and projection refresh. Client state is optimistic only after server confirmation.
- Counts on dashboard, owner profile, public profile and wallet are read from the same versioned projection. Public cache keys include profile privacy/recognition version; private pages are not shared.
- Accessible empty/error/loading states must state whether no award exists, a reward is pending, or a page cannot load—never substitute demo values.

## 4. Messaging rules

| Event | Message principle |
|---|---|
| Award/tier promotion | State what was earned, why in concise safe terms, and link to owner profile. |
| Pending/declined operational benefit | State that host/availability confirmation is required; no “guaranteed” language. |
| Referral approval/reversal | Existing referral language remains, but balance is shown only once an actual ledger entry exists. |
| Revocation/correction | State the broad reason/category, safe appeal path and effective impact; do not expose third-party or fraud data. |
| Expiry | Send only for approved expiring rewards and only once per event/delivery idempotency key. |

## 5. Acceptance criteria

- [ ] No second travel profile or second stamp collection is rendered.
- [ ] Private evidence and hidden awards never enter public DTOs, metadata or caches.
- [ ] Achievements are never claimable from client controls.
- [ ] All display states are backed by server projections, not wallet literals.
- [ ] Operational benefits clearly distinguish eligibility, request, confirmation and redemption.
