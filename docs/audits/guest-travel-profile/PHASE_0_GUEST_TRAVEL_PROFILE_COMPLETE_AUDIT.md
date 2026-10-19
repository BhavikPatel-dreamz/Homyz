# Phase 0 — Guest Travel Profile & Social Identity Complete Audit

**Scope:** report-only audit of the requested guest travel profile, public identity, gallery, social, privacy, and supporting platform work. No application, schema, migration, or configuration was changed. Findings are based on source inspection; no database-connected or mutating test was run.

## Executive assessment

Homyz has a useful foundation: one account owns bookings, reviews, an avatar, an editable JSON profile, a small TripPhoto table, media validation/storage, generic notifications, and a mature moderation framework. It does **not** yet have a safe, complete travel-social domain. The current TripPhoto feature is an owner-side profile-management gallery, not a public/private social photo system.

The Phase 1 foundation should be a typed `TravelProfile` and travel-media/privacy domain associated with every `User`, regardless of their host/admin role. Do not solve this by adding another role. The current single role model already promotes a guest to `HOST` when they become a host, so role-based “guest profile” ownership would be incorrect.

## Architecture and reusable building blocks

| Area | Current state | Reuse assessment |
| --- | --- | --- |
| App architecture | Next.js 16.3 App Router, React 19, TypeScript, Prisma/Postgres, NextAuth JWT/cookie and bearer access for mobile. | Reuse service/action/API conventions; all server authorization remains authoritative. |
| User identity | `User` has avatar, name, email/phone, `publicProfile Json`, booking/review relations, and host flags. | Reuse account identity, but add a typed travel profile rather than extending an unbounded JSON blob. |
| Owner profile shell | Protected `/profile` with profile tabs; `ProfileClient` already renders identity, stats, gallery, and management entry points. | Reuse visual shell/components selectively; split public read models from owner views. |
| Public profile route | `/profile/[id]` loads a user, photos, and stats, then renders `ProfileClient`. | Rework before relying on it: route matcher appears to require auth and all photos are loaded without per-item visibility. |
| Host public profile | `/users/profile/[id]` uses a deliberately selected `getPublicHostProfile` DTO. | Good example of a separate public-safe query and public page, but it represents hosting identity—not guest travel. |
| Photo editing UI | Existing modal/grid/lightbox supports caption, free-text location, free-text tags, edit/delete. | Reuse modal and media UI patterns; replace data semantics, upload workflow, and access rules. |
| Modal behavior | `ModalOverlay` locks body scrolling reference-countedly and keeps overscroll contained. | Reuse for every gallery, share, report, comment, and confirmation modal. |
| Media service | Signature validation supports JPEG/PNG/WebP/AVIF; backend can be S3, the internal media service, or local fallback. | Reuse validation and managed delete, but introduce travel-aware public/private delivery and variants. |
| Booking/review data | `Booking` links guest/listing/dates/status; review service protects direction and eligibility. | Reuse as verified-travel evidence. Do not copy booking/review records into the social domain. |
| Notifications | Generic model/service with entity link and metadata. | Extend enum/event idempotency for social activity. |
| Moderation | Generic report/case/evidence workflow for profiles, users, reviews, listings, listing photos, and messages. | Extend target resolution to travel photos and travel comments. |
| Caching | Redis cache-aside helpers and revalidation already exist. | Reuse only with visibility-aware keys/DTOs; current profile/stat caches are unsafe or semantically inadequate for this feature. |

## Requirement-by-requirement audit

Legend: **Complete** = available and fit for purpose; **Partial** = reusable but needs material work; **Missing** = no implementation; **Broken** = exists but conflicts with the requirement; **Blocked** = must be verified before implementation.

| Requested capability | Status | Evidence and audit finding |
| --- | --- | --- |
| Account identity, avatar, name | Partial | `User` supplies name/image and profile edit. Avatar upload is reusable, but no travel cover image or travel-specific public DTO. |
| Guest travel profile for every account | Missing | There is no typed travel profile model. `publicProfile` is a free-form JSON object. |
| Host and guest identities can coexist | Broken | `USER` is promoted to `HOST` by listing/host application flows; admin guest lists filter only `role: USER`. A travel identity must be independent of role. |
| Public guest profile | Broken | `/profile/[id]` exists, but the proxy matcher covers `/profile/:path*`; its logged-out behavior must be fixed and tested. It fetches every TripPhoto with no photo-level privacy. |
| Public host profile | Complete for host scope | `/users/profile/[id]` has a purpose-built, selected public DTO. It should remain separate from travel social identity. |
| Cover image | Missing | No schema field, upload endpoint, crop/variant flow, or UI. |
| Bio, home/current location, languages/prompts | Partial | Values can live in `publicProfile`; validation is permissive and lacks a stable contract/size and visibility policy. |
| Public handle/slug | Missing | Public travel page is ID-based only. |
| Share controls | Missing | No share endpoint, canonical travel URL, Open Graph route, or audit trail/rate limiting. |
| Trips counter | Broken | Current stats count every booking—including pending/cancelled—and use `max(bookings, photos)`, not completed/verified travel. |
| Reviews counter | Partial | Reviews are counted but not restricted to the intended guest-travel direction/meaning. Define whether it means reviews written, received, or both. |
| Likes counter | Missing | Current stats return a hard-coded `0`; no profile/photo likes exist. |
| Countries/destination carousel | Missing | Listing city/country strings and a generic location search exist, but no normalized visited destinations or evidence source. |
| Travel photo grid/lightbox | Partial | Owner gallery and lightbox exist. It is not a paginated public gallery, has no variants, and no per-photo visibility/moderation status. |
| “Posts” navigation/feed | Missing | No travel post/feed aggregate, cursor API, or navigation state. |
| Add photos with preview | Partial | UI previews selected images and supports parallel upload. It uses the listing-photo upload endpoint and has no durable upload session/recovery. |
| Drag/drop upload | Missing | The UI presents a dropzone but does not wire drag-over/drop handling. |
| Maximum five photos per trip | Missing | No Trip/album model and no server-side limit or transactionally enforced count. |
| Progress, cancel, retry, cleanup | Partial | Count-based client progress exists. No byte progress, cancellation, retry policy, upload session, or orphan cleanup/reconciliation. |
| Caption/location/tag people | Partial | Caption and free strings exist. Location is not canonical; tags are `String[]` labels rather than user relations, consent states, or notification targets. |
| Photo privacy | Broken | Trip photo URLs use public listing-media storage and `getTripPhotos` returns all photos by user. |
| Verified completed stays | Partial | Booking dates/status can derive a completed confirmed stay, but there is no durable travel evidence/visit projection. |
| Self-declared destinations | Missing | No user destination/visit model. |
| Travel stamps | Missing/retired | Save logic deliberately removes prior travel-stamp JSON keys; there is no catalog or award model. |
| Achievements/badges | Missing | Superhost and Guest Favorite are host/listing qualifications, not guest travel achievements. |
| Profile visibility | Partial | A boolean `publicProfile.profileVisible` gates the public page, but it is not a complete privacy matrix and does not protect direct photo retrieval/public media. |
| Profile/photo likes | Missing | No models, APIs, UI, counter strategy, or notification behavior. Listing favorites are unrelated. |
| Follow/unfollow | Missing | No relation, privacy state, block integration, or follower views. |
| Comments/replies | Missing | No comment/reply model, deletion/edit policy, moderation target, or notification flow. |
| User blocking | Missing | No block relation or systematic enforcement across profiles, likes, comments, tags, and notifications. |
| Social notifications | Missing | Notification framework exists but its enum covers only booking, message, promotion, and system categories. |
| Social moderation | Partial | The generic case/report framework is sound, but target validation has no TripPhoto/travel-comment support. |
| Responsive, accessible modal behavior | Partial | Existing overlay meets the scroll-lock requirement. The requested guest screens and keyboard/screen-reader states are not implemented or verified. |
| Tests and release proof | Partial | 204 test files and relevant profile/media/moderation tests exist, but no package `test` script; this audit did not execute DB-touching tests. Feature-specific privacy/social coverage is absent. |

## Priority risks and recommended decisions

### P0 — resolve before exposing a travel profile

1. **Private-data boundary.** `toPublicUser` includes sensitive fields (including email, phone, birth date, role/status); `getById` caches it by target user. The current page manually nulls two fields, which is fragile. Create explicit owner, authenticated-viewer, and anonymous-public DTO/query functions. Never cache a viewer-dependent DTO using only target user ID.
2. **Photo privacy and storage.** Current travel photos are uploaded as public listing media. A privacy switch cannot secure an already public immutable URL. Add a travel-media storage kind and authorized/signed delivery for non-public assets before introducing photo-level privacy.
3. **Direct photo enumeration.** `getTripPhotosAction(targetUserId?)` accepts another user ID without a visibility check; the service returns all that user's photos. Close/rework this interface as part of the foundation.
4. **Role collapse.** Keep travel records keyed to `User.id`, never `Role.USER`. Decide whether the broader account model will ultimately support multiple capabilities/roles; Phase 1 must at least not add more role mutation.
5. **Schema/migration drift.** A historical migration creates `HostGuestReview`, while the current schema represents two-directional `Review`. Verify `prisma migrate status` and a production-like database before adding migrations; do not “repair” history blindly.

### P1 — required product decisions

- Default travel-profile visibility: recommended **private** until the member chooses public.
- Counter semantics: recommended **verified trips = confirmed bookings whose checkout is past**, distinct **verified destinations**, **published guest-to-property reviews written**, and **received profile likes**. Keep self-declared places visually distinct.
- Social scope: launch likes separately from follows/comments. Follows, replies, tagging consent, and blocking create a larger safety/notification surface.
- Travel photos: decide whether a photo may exist outside a trip. Recommended: allow an unassigned draft, require association before public publication, and enforce the five-photo cap per published trip server-side.
- Travel identity URL: use an immutable public identifier plus a separately managed slug/handle; do not use mutable display name or raw database ID as the sole public contract.

## Existing behavior details

### Identity and authorization

- Session/API paths perform live-user checks, and service-layer authorization is the right pattern to continue.
- `User.role` has only `ADMIN`, `HOST`, and `USER`. Listing creation and host conversion promote a `USER` to `HOST`; admin guest reporting then excludes that person. This is a pre-existing product/data-model limitation.
- The authenticated people-search API returns email alongside name/image, which is inappropriate as the source for public tagging. A future tag picker should return a minimum safe identity DTO and enforce relationship/block/tag consent rules.

### Bookings, reviews, destinations

- A database booking only has `PENDING`, `CONFIRMED`, and `CANCELLED`; application code derives “completed” from a confirmed booking whose checkout/end is past. Use one shared eligibility function to avoid timezone/status drift.
- Listings retain city/country strings and coordinates but there is no normalized destination. Normalize country to ISO code and canonicalize city/place identifiers; preserve original display text only as presentation metadata.
- The existing review uniqueness and guest-to-property direction are useful evidence, but reviews must remain their own source of truth.

### Media and gallery

- Existing signature/file-size validation is a good base. It does not yet provide EXIF handling, image dimensions, thumbnail/transcode variants, deduplication, or travel-media access control.
- `TripPhoto` has URL/caption/location/tags and owner/time indexes only. It has no trip, destination, visibility, state, moderation, verified-booking, media-key, relational tag, or social relation.
- Creates use `Promise.all` without a transaction; upload happens before record creation. Failure can leave managed public uploads orphaned.
- The gallery fetch is unpaginated. A public grid must use cursor pagination and image variants, not original image URLs for every tile.

### Notifications and moderation

- Existing notification deduplication is an application-level lookup followed by create and has no database unique idempotency key. Social event fan-out needs a unique event key/outbox or equivalent transactional strategy.
- The moderation system can report profiles/users and listing photos, but its target resolver rejects generic other content and cannot find a TripPhoto. Add typed travel targets and lifecycle effects (hide, restore, delete) before public publication.

## Verification notes and source evidence

Selected primary evidence (line numbers are from this audit checkout):

- `prisma/schema.prisma:19-47, 290-386, 416-452, 549-576, 768-779, 810-846, 852-940, 1054-1109, 1975+` — roles, notification/booking enums, user, photo, listing/favorite/booking, moderation/review, and CMS media models.
- `services/user.service.ts:24-48, 51-100, 241-319, 360-448` — cached profile query, retired stamps, TripPhoto CRUD/stats, and safe host-profile query.
- `app/profile/[id]/page.tsx:6-50` and `proxy.ts:5-11` — current public profile loader and route protection matcher.
- `actions/user/tripPhotos.ts:9-59` — target-user photo retrieval and owner mutations.
- `app/(protected)/profile-management/profile-management-client.tsx:1575-1784, 1870-2171` — gallery/privacy UI and upload behavior.
- `app/api/v1/upload/listing-photo/route.ts:12-62`, `services/listing-media.service.ts:85-168`, `lib/storage/media.ts:4-10` — existing upload/media foundation.
- `lib/booking/booking-status.ts:95-268`, `services/booking.service.ts:857-931`, `lib/reviews/review-eligibility.ts:61+` — completed-stay derivation and bookings.
- `services/host-application.service.ts:564-625`, `services/listing.service.ts:1390-1401`, `services/admin.service.ts:2470-2495` — role promotion and guest filtering.
- `services/notification.service.ts:175-249`, `services/moderation.service.ts:277-435` — notification and report/case behavior.
- `components/ui/modal-overlay.tsx:1-35` — mandated reusable overlay/scroll lock behavior.

## Phase 1 entry criteria

Proceed only after product owners decide visibility defaults, counter definitions, social launch scope, and the travel URL model; engineering verifies migration state in a non-production clone; and a threat-model review signs off on DTO splitting and private-media delivery. The first implementation increment should not expose a public gallery until those boundaries are in place.
