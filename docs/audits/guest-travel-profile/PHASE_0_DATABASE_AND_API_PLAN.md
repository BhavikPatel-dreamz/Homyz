# Phase 0 — Database and API Plan

This is a recommended target shape, not an approved migration. Validate Prisma migration history and production-like data first; the current history shows a historical `HostGuestReview` migration while the checked-in schema uses the two-direction `Review` model.

## Design principles

1. The owner is always `User.id`; a traveler must not require `Role.USER`.
2. Put public/owner/viewer projections behind separate query functions and DTOs.
3. Privacy is enforced before media URL issuance, not after rendering a public URL.
4. Keep booking and review as source systems. Store travel projections/evidence, not copied mutable booking facts.
5. Use explicit relations and database uniqueness for social edges. Do not store people, counters, or destinations in profile JSON.
6. Start counters as query aggregates or transactionally reconciled counters; never trust client increments.

## Proposed data model

| Model | Key fields / constraints | Purpose |
| --- | --- | --- |
| `TravelProfile` | `userId @unique`, `handle @unique` (nullable until claimed), `bio`, `homeDestinationId?`, `visibility`, `coverMediaId?`, timestamps, visibility version | Typed travel identity without overloading `User.publicProfile`. |
| `Destination` | canonical name, normalized name, `countryCode`, admin region, lat/lng?, provider/place ID?, `@@unique([countryCode, normalizedName, providerPlaceId])` as appropriate | Canonical destination grouping and country carousel. |
| `UserDestination` | `userId`, `destinationId`, `firstVisitedAt?`, `lastVisitedAt?`, `selfDeclared`, `visibility`; `@@unique([userId, destinationId])` | One displayable travel relationship per member/destination. |
| `TravelVisitEvidence` | `userDestinationId`, `bookingId @unique?`, source enum (`VERIFIED_BOOKING`, `MANUAL`), status/time | Auditable evidence; only confirmed and past booking evidence may mark verified. |
| `TravelTrip` | `userId`, `title?`, `destinationId?`, `startedAt?`, `endedAt?`, `visibility`, `status`, `coverPhotoId?`, timestamps | The container needed for per-trip limits and grouping. Allow a draft; require valid state before public publication. |
| `TravelPhoto` | preserve/backfill `TripPhoto` or introduce new table: `userId`, `tripId?`, `mediaAssetId`, caption, `destinationId?`, `visibility`, `publicationStatus`, `moderationStatus`, `sourceBookingId?`, soft-delete timestamps | Replace raw public URL with a managed asset reference and explicit lifecycle. |
| `PhotoTag` | `photoId`, `taggedUserId`, `status` (`PENDING`, `ACCEPTED`, `DECLINED`, `REMOVED`), `createdById`; `@@unique([photoId, taggedUserId])` | Consent-aware people tags. |
| `ProfileLike` | `actorId`, `targetUserId`, `createdAt`; `@@unique([actorId,targetUserId])`; DB check actor != target | One idempotent profile reaction. |
| `TravelPhotoLike` | `actorId`, `photoId`, `createdAt`; `@@unique([actorId,photoId])`; no self-like policy enforced in service/DB where possible | One idempotent photo reaction. |
| `UserBlock` | `blockerId`, `blockedId`, timestamps; `@@unique([blockerId,blockedId])`; DB check IDs differ | Safety edge enforced across all social queries/events. |
| `TravelComment` (later) | `photoId`, `authorId`, `parentId?`, body, status, edited/deleted timestamps | Only if comments are approved after reactions launch. |
| `TravelStamp` / `UserTravelStamp` | versioned catalog, criteria metadata, award evidence/status; unique member+stamp version | Separate from legacy retired JSON and host badges. |
| `TravelAchievement` / assignment | catalog version, qualification source, award/revoke timestamps | Supports evolving achievement criteria without rewriting history. |

### Required supporting extensions

- Add `SOCIAL` to `NotificationType` (or explicit social subtypes) and an `eventKey` with a database unique constraint. This replaces lookup-then-create idempotency for fan-out.
- Add `TRAVEL_PHOTO` and, when comments exist, `TRAVEL_COMMENT` to moderation target types; extend all target-resolution, reporting, case, hide/restore, and admin-display branches.
- Add a travel-media asset/storage category. Public published media may have immutable CDN URLs; private/unlisted/draft/quarantined media must be authorized or signed and revocable.
- Add indexes for public queries, e.g. `(userId, publicationStatus, visibility, createdAt DESC)`, `(tripId, createdAt)`, destination aggregate lookups, and each target-side social edge.

## Invariants to enforce server-side

- Only the owner can edit their profile, trips, photos, and self-declared destinations.
- Only `CONFIRMED` bookings whose checkout is past can generate verified evidence; cancelled/pending stays never count as verified travel.
- A published trip can have no more than five active photos. Enforce in a transaction with a locking/count strategy, not only in the browser.
- A photo's owner must equal its trip owner; a tag cannot target a blocker/blocked member; only permitted viewers can see a tag or generate a notification.
- A public DTO never contains email, phone, birth date, account role/status, private asset keys, or raw private media URLs.
- A user may not like themselves; repeated like/unlike calls are idempotent. Apply block checks before reads, writes, counters, and notifications.
- Moderation state overrides normal visibility. Removed/quarantined content is not returned or linked to non-moderators.

## API surface proposal

Use existing service-layer authorization and zod validation; route names are illustrative and should fit the project’s versioned API conventions.

| Endpoint / action | Audience | Contract and notes |
| --- | --- | --- |
| `GET /api/v1/travel-profiles/me` | owner | Full editable profile, private counts, drafts; `Cache-Control: private, no-store`. |
| `PATCH /api/v1/travel-profiles/me` | owner | Typed allow-listed fields; validate cover asset ownership and visibility changes. |
| `GET /api/v1/travel-profiles/{handle}` | anonymous/viewer | Explicit safe public DTO only; returns 404 for hidden/blocked/unpublished profile. Cache only viewer-neutral public response. |
| `GET /api/v1/travel-profiles/{handle}/photos?cursor=` | anonymous/viewer | Cursor-paginated only; applies profile/photo visibility, moderation and block policy before issuing display URLs. |
| `POST /api/v1/travel-media/uploads` | owner | Create upload session/presigned target for an allowed travel asset type; no listing-media endpoint reuse. |
| `POST /api/v1/travel-media/uploads/{id}/finalize` | owner | Verify asset, generate variants, attach to a draft photo/trip transactionally, return processing state. |
| `POST/PATCH/DELETE /api/v1/travel-trips...` | owner | Trip lifecycle and five-photo policy. |
| `POST/DELETE /api/v1/travel-photos/{id}/like` | authenticated viewer | Idempotent reaction after public/relationship/block checks. |
| `POST/DELETE /api/v1/travel-profiles/{id}/like` | authenticated viewer | Idempotent profile reaction. |
| `POST /api/v1/travel-photos/{id}/tags` | owner | Create pending user tags from IDs only; never from email/free labels. |
| `POST /api/v1/blocks/{userId}` / `DELETE ...` | authenticated viewer | Safety edge; triggers visibility/notification consequences. |
| `POST /api/v1/moderation/reports` | authenticated viewer | Extend existing target resolver; no parallel moderation subsystem. |

## Query and cache plan

| Query class | Caching policy |
| --- | --- |
| Owner editor / uploads / private assets | `private, no-store`; no shared target-only cache. |
| Anonymous public profile/gallery | Shared cache only when result is genuinely viewer-neutral and contains public processed variants. Use a profile visibility/version key and invalidate on profile/media/moderation changes. |
| Authenticated viewer with blocks, follows, pending tags, or unlisted grants | Viewer-keyed or `no-store`; never reuse the current target-only `getById` cache pattern. |
| Counts | Start aggregate query with bounded indexes. If denormalized later, update transactionally/outbox and run reconciliation jobs. |

## Migration and backfill sequence

1. **Preflight:** backup/restore rehearsal, `prisma migrate status` against a non-production clone, reconcile schema/history drift, inventory current TripPhoto URLs and orphan media.
2. **Additive schema:** add new models/enums/indexes without changing existing reads. Do not drop legacy JSON/TripPhoto columns.
3. **Media preparation:** add travel media kind, private delivery policy, variant generation, and operational cleanup metrics.
4. **Backfill:** create a `TravelProfile` for existing users; migrate legacy TripPhoto records as owner-only/private drafts unless explicit valid public consent can be proven. Convert free-text location only where canonical matching is confident; retain unmatched text as display metadata.
5. **Dual-read/dual-write:** internal owner UI uses new APIs while comparison metrics validate counts/assets. Do not publish migration-backfilled photos automatically.
6. **Public launch:** enable only safe public profiles/media, cursor reads, and reporting; monitor forbidden/media failures and cache divergence.
7. **Retirement:** after retention window and verified cleanup, remove old TripPhoto read paths and stale JSON compatibility fields in a separately reviewed migration.

## Security/privacy checklist

- Threat-model URL guessing, stale CDN links, logged-out access, blocked users, direct server-action invocation, deleted media, and moderator-only content.
- Verify CSRF/auth conventions for mutations, rate-limit upload/like/report endpoints, and use strict payload limits.
- Never use the authenticated user-search endpoint as a public discovery directory; do not reveal email in social/tag results.
- Log moderation/visibility decisions without logging private captions, URLs, or personal details unnecessarily.
- Require accessible alt-text policy (required or generated/reviewed) for published imagery and preserve consent/attribution metadata where product requires it.
