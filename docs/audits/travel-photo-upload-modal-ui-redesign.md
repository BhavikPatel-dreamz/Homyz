# Travel photo upload modal UI/UX redesign

## Audit findings

The existing modal had a working upload pipeline but presented trip fields before the user could see selected images, used a basic native trip dropdown, had unlabeled date controls, and uploaded automatically as soon as a new trip became valid. This made captions, locations, and image selection feel like a secondary administrative task. The preview was a small grid rather than a clear primary image, and existing trips with the same name were not distinguishable.

## Reused functionality

- `TravelPhotoUploadModal` remains the only upload modal.
- Existing `/api/v1/travel-media/trips` and `/uploads` contracts, file validation, sequential XHR progress, retries, object-URL cleanup, trip creation, and gallery callbacks are unchanged.
- Existing `TagPeopleInput`, country search, `TravelTripDTO` capacity fields, and `MAX_PHOTOS_PER_TRIP` are reused.
- The existing trip PATCH endpoint is used after a successful batch to persist the user-selected cover photo; no schema or service relationship changed.

## Layout and interaction changes

- Added the requested “Share Your Travel Moments” header and compact image-first empty state with a Select Photos action.
- The trip form is hidden until photos have been selected, avoiding a large empty preview/form combination.
- Selected photos now have a large active preview, highlighted thumbnails, a count indicator, remove actions, an add-more action, and cover-photo selection.
- Uploading is now explicit. Selection stores local previews first, then `Create trip & share` / `Share photos` performs the existing one-step create-and-upload workflow. This prevents accidental uploads and duplicate trip creation from form completion.
- The trip selector is now a styled accessible disclosure/listbox. Its rows use persisted IDs, country, date, photo count, and remaining capacity. Full trips are visibly marked and unavailable.
- Start and end dates have visible labels plus inline end-before-start validation.
- The modal has a mobile-safe rounded-sheet size, internal scroll area, sticky publishing action in the edit state, and a discard confirmation for unsaved selections.

## Duplicate trip option finding

`getUserTrips` performs one `travelTrip.findMany` query and maps each persisted trip by its ID. No UI-side duplicate generation was found. Identical titles remain valid distinct records; the redesigned selector distinguishes them by country and start month/year rather than collapsing or deleting data.

## Files modified

- `components/travel/travel-photo-upload-modal.tsx`
- `__tests__/travel-photo-upload-modal-ui-redesign.test.ts`

## Verification

- `npx tsc --noEmit --pretty false`
- `npx eslint components/travel/travel-photo-upload-modal.tsx`
- `npx tsx --test __tests__/travel-photo-upload-modal-ui-redesign.test.ts`
- `git diff --check`

## Remaining limitation

There is no browser automation dependency configured in this workspace. The redesign was verified through TypeScript, targeted lint, focused source-level workflow checks, and the existing real upload API contracts; visual interaction should still be spot-checked in a browser at desktop and mobile breakpoints.
