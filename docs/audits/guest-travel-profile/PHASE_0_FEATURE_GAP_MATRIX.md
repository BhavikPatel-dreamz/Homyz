# Phase 0 — Feature Gap Matrix

Status reflects implementation fit, not visual resemblance to a reference. “Reuse” identifies a starting point, not approval to expose it unchanged.

| Area / requirement | Status | Existing implementation | Gap / risk | Recommended Phase 1–2 response |
| --- | --- | --- | --- | --- |
| User account identity | Partial | `User` name/image/publicProfile; auth/session and service guards. | Public profile data is mixed with private fields through generic mapper. | Split owner/public/viewer DTOs; keep one User owner. |
| Guest travel identity | Missing | No typed model. | JSON does not give schema, visibility, auditability, or relations. | Add 1:1 `TravelProfile`. |
| Guest + host coexistence | Broken | A single role enum, host promotion on listing/application. | A host disappears from role-filtered guest operations. | Key travel domain to User; plan capabilities/memberships separately. |
| Public guest profile URL | Partial/Broken | `/profile/[id]`. | Likely proxy-auth gated; raw ID route; no share/canonical metadata. | New public route/slug policy and anonymous access tests. |
| Owner profile management | Partial | Protected profile tabs and `ProfileClient`. | Current view combines owner and public concerns. | Reuse components behind separate view models. |
| Cover image | Missing | Avatar only. | No asset, crop, accessibility text, or delivery policy. | Add cover asset reference and variants. |
| Profile fields | Partial | Free-form `publicProfile`; 500-char bio trim. | No strict field schema, validation, or field-level visibility. | Typed fields with Zod/service validation. |
| Privacy control | Partial | `profileVisible` boolean. | No audience model; media remains public/directly enumerable. | Profile and photo visibility/state plus block enforcement. |
| Share | Missing | No share UI/API/OG. | Cannot safely share public identity. | Canonical public URL, share UI, OG/metadata, rate limits. |
| Verified trip count | Broken | `max(all bookings, all photos)`. | Counts pending/cancelled and invented photo count as travel. | Derive/project confirmed, past stays using shared eligibility. |
| Review count | Partial | Published authored reviews count. | Direction and user-facing meaning are undefined. | Count published `GUEST_TO_PROPERTY` reviews written, unless product decides otherwise. |
| Likes count | Missing | Hard-coded zero. | No social relation. | Aggregate ProfileLike / approved PhotoLike per UX decision. |
| Destinations/countries | Missing | Listing city/country strings; location search. | No canonical destination, visit, verification, or carousel. | `Destination`, `UserDestination`, evidence projection. |
| Self-declared places | Missing | None. | Cannot distinguish claims from verified stays. | Separate source/status and visual treatment. |
| Photo grid/lightbox | Partial | Owner TripPhoto grid/lightbox. | No pagination, variants, public permissions, or moderation. | Build public gallery query after travel-media foundation. |
| Photo upload validation | Partial | Existing public image magic-byte/type/10 MB checks. | Uses listing endpoint/storage; no dimensions/EXIF/asset states. | Reuse validator with travel-media endpoint and async processing. |
| Upload flow | Partial | Preview and three-worker client upload. | No drag/drop, byte progress, cancel/retry, resume, atomic finalization. | Signed/session upload + finalize endpoint + cleanup worker. |
| Five photos per trip | Missing | No trip model, no server cap. | UI-only limits would race/bypass. | Enforce transactionally on published trip membership. |
| Caption and location | Partial | String fields. | Location cannot group/map reliably. | Relate photo/trip to canonical destination; retain display override. |
| Tag people | Broken/Partial | `tags: String[]`; user search available. | Tags are display strings, emails can be exposed, no consent/block/moderation. | `PhotoTag` relation with pending/accepted status. |
| Travel photo visibility | Broken | Public listing-media URLs; all owner photos fetched. | “Private” cannot revoke a public static URL. | Private delivery/proxy/signed URL before UI controls. |
| Travel posts/feed | Missing | None. | No cursor model/API/navigation. | Decide whether photos are posts or a separate feed; defer feed initially. |
| Profile likes | Missing | None. | No uniqueness/self-like/block policy. | `ProfileLike` uniqueness and event rules. |
| Photo likes | Missing | None. | No uniqueness/count/cache/moderation policy. | `PhotoLike`; initially compute aggregate or reconcile counter. |
| Follows | Missing | None. | Adds privacy, block, fan-out, and abuse surface. | Separate later phase, only after block rules. |
| Comments/replies | Missing | None. | Adds text moderation/edit/delete/notification complexity. | Defer behind reactions; model threaded comments if approved. |
| Blocking | Missing | None. | Required cross-cutting safety control for social features. | `UserBlock`; enforce in every read/write/event query. |
| Social notifications | Partial | Generic notification entity/link/metadata. | No enum/event type or DB idempotency constraint. | Add `SOCIAL`, unique event key/outbox, preference checks. |
| Reporting/moderation | Partial | Reports/cases for profiles/users/listing photos. | No travel-photo/comment target resolver or hide lifecycle. | Extend enums, resolver, admin queue, and evidence access. |
| Travel stamps | Missing/retired | Save code deletes old stamp JSON keys. | No catalog/award/evidence. | New catalog + assignment only after criteria design. |
| Achievements | Missing | Superhost/Guest Favorite only. | Existing badges are not traveler achievements. | Separate traveler catalog/criteria/versioned award records. |
| Media deletion | Partial | Managed delete after TripPhoto DB delete. | Best-effort; possible upload/DB or storage cleanup orphans. | Soft-delete/state machine and reconciler. |
| Cache policy | Partial | Cache-aside profile/stats. | Viewer-blind profile key and stale stats; no photo visibility keys. | Public viewer-neutral DTO cache; private `no-store`; explicit invalidation. |
| Performance | Partial | Indexed basic TripPhoto lookup; existing cache. | Unbounded photo list/original assets, no cursor/variants. | Cursor pages, thumbnail variants, aggregate indexes, limits. |
| Accessibility/responsiveness | Partial | Reusable `ModalOverlay` implements body scroll lock. | New screen focus, labels, keyboard, mobile layouts unverified. | Include acceptance tests at 320px/tablet/desktop. |
| Test automation | Partial | 204 test files; relevant profile/media/review/moderation suites. | No package test script; no end-to-end social/privacy suite. | Add focused non-mutating unit/integration/E2E commands in feature PRs. |
| Deployment/operations | Partial | Docker/media service and environment patterns. | Media-server README is stale; production migration state not audited. | Validate runtime contract, upload cleanup, monitoring, migration plan. |

## What must not be repurposed

- `ListingFavorite` is a guest-to-listing relation, not a profile or photo like.
- Superhost and Guest Favorite qualifications are host/listing signals, not guest achievements.
- `publicProfile` should not become the long-term store for cover URLs, social counters, visibility matrices, destinations, or badge assignments.
- Public listing-photo storage cannot be labeled “private trip photos.”
- Free-text TripPhoto tags cannot be treated as consented person tags.

## Launch cut recommendation

The smallest safe public launch is: typed editable travel profile, safe public DTO/route, cover/avatar, verified-trip and review counters with defined semantics, destinations with source labels, a privacy-safe public photo gallery with only public media, and reporting. Launch profile/photo likes only once block rules and idempotent notifications are present. Defer follows, comments/replies, and advanced achievements to later increments.
