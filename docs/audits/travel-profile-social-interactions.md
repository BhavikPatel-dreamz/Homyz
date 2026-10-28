# Travel Profile social interactions audit

## Existing state

The application already had persisted photo likes (`TravelPhotoLike`), a Likes
tab, profile sharing, and a follower relation with centralized travel privacy
checks. Photo likes were authorized server-side and the public profile already
rendered the follow button. Missing pieces were trip reactions, comments,
follower/following lists, public deep links for individual travel content, and
consistent travel-like statistics.

## Delivered

- Added persisted `TravelTripLike` and `TravelPhotoComment` models using
  constraints and indexes. Existing `TravelPhotoLike` remains the single photo
  reaction model; its legacy `userId` column is now explicitly mirrored from
  `actorId` for old and new databases.
- Added authorized trip likes, photo comment create/list/edit/delete, cursor
  pagination, comment count, owner moderation, content sanitization, limits,
  author details, and loading/empty/error states in the photo modal.
- Added an optimistic public-gallery photo like control and an optimistic trip
  like control in the slider. Existing detail-modal photo likes continue to
  use the authoritative server response and rollback on errors.
- Added public, stable `?photo=` and `?trip=` travel-profile deep links only
  for public profile/content combinations. Shared links still pass through the
  normal profile/photo/trip privacy authorization; no share token or bypass is
  introduced.
- Added follower and following counts plus protected, searchable, paginated
  lists. Direct list calls are restricted to the owner or a public profile;
  private/followers-only lists cannot be enumerated by outsiders.
- Reused the notification service for follows, trip likes, and photo comments.
  “Likes” on a profile now means reactions received on the profile, its travel
  photos, and its trips—not content the traveler has liked.
- Replaced the Likes-tab per-card access checks with a batch privacy helper to
  avoid an N+1 query pattern.

## Database/API changes

- `prisma/migrations/20261027170000_add_travel_social_interactions`
- `GET/POST /api/v1/travel-media/photos/[id]/comments`
- `PATCH/DELETE /api/v1/travel-media/comments/[id]`
- `GET/POST /api/v1/travel-media/trips/[id]/like`
- `GET /api/v1/travel-media/trips/[id]/public`
- `GET /api/v1/travel-profiles/[userId]/follows`

## Verification

Passed:

- Prisma generation and schema validation
- Focused ESLint on all changed social files
- TypeScript check
- `npx tsx --test __tests__/travel-profile-social-interactions.test.ts __tests__/travel-profile-stamp-management.test.ts`

The integration test covers photo/trip like persistence, own-like prevention,
comments and owner moderation, follow idempotency/counts/self-follow
prevention, and private-profile authorization. Browser visual regression tests
were not run in this environment.
