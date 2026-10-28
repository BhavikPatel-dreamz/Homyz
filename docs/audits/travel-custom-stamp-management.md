# Travel custom-stamp management audit

## Existing architecture

Travel stamps use the existing `TravelStamp` catalog and the per-user
`UserTravelStamp` collection record. The profile and public profile already
read the same collection; `evidenceMetadata.isPublic` controls whether an
individual stamp is visible when the stamp section itself is public.

Before this change, the My Travel Stamps picker only selected existing catalog
stamps. Stamp artwork upload existed only in the admin travel-stamp workflow.
The application media layer already writes public assets to S3 or the dedicated
media service, so no local upload directory was added.

## Implemented changes

- Added `TravelStamp.ownerId` and `TravelStamp.isCustom`, with a creator
  relation and index. Personal stamps reuse the collection model instead of
  adding a parallel stamp system.
- Added `POST /api/v1/travel-media/stamps/custom-upload` for authenticated
  members. It accepts PNG/JPEG/WebP only, has a 5 MB cap, verifies signatures,
  validates 64–6000 pixel dimensions, uses the shared media server/S3 storage
  adapter, creates unpredictable owner-prefixed names, and rate limits uploads.
- Added owner-authorized create, update, and permanent delete server actions.
  Personal stamps are automatically placed in the creator's collection,
  idempotently prevent the same name/artwork save from creating another entry,
  and only their creator can read them in the picker or change them.
- Added a compact personal-stamp editor inside the existing picker. It supports
  media upload with progress/retry errors, image preview in the circular stamp
  treatment, choosing an owned travel photo, name/location editing, individual
  visibility, replacement, and delete confirmation.
- Added owner-only edit affordances and a Personal label in the existing
  profile stamp section. Normal removal only removes the collection entry;
  it does not delete personal artwork. Permanent delete removes the owned
  custom stamp and best-effort deletes its managed artwork.
- Official catalog stamps and achievement eligibility are unchanged. Personal
  stamps use `isCustom`/`ownerId` for classification and cannot take part in
  destination verification or automated awards.

## Database and deployment note

The custom-stamp migration is additive and idempotent. The configured database
was missing the two new columns, so this exact migration was applied directly
to make the implementation testable. `prisma migrate status` still reports a
pre-existing migration-history mismatch: the database contains older migration
entries that this checkout does not have, plus a later missing local migration.
Resolve that repository/database history mismatch before relying on
`prisma migrate deploy` as the deployment mechanism; do not remove or reset
the recorded migrations.

## Files changed

- `prisma/schema.prisma`
- `prisma/migrations/20261027000000_add_custom_travel_stamps/migration.sql`
- `lib`-integrated custom upload route and travel-stamp server actions/service
- `components/travel/travel-stamp-manager-modal.tsx`
- `components/travel/travel-stamps-section.tsx`
- `types/travel.ts`
- `__tests__/travel-custom-stamp-management.test.ts`

## Verification

Passed:

- `npx prisma generate`
- `npx prisma validate`
- `npx tsc --noEmit`
- Focused ESLint on all changed TypeScript/TSX files
- `npx tsx --test __tests__/travel-custom-stamp-management.test.ts __tests__/travel-profile-stamp-management.test.ts`

The integration test covers persistence, idempotent repeated save, owner-only
picker visibility and mutation, individual public visibility, detail editing,
creation from an owned travel photo, and permanent deletion. Upload file
validation is implemented at the route boundary; a browser-level upload against
the media service was not run in this environment.
