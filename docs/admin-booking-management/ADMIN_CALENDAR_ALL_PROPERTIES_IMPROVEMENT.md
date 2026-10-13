# Admin Reservation Calendar: all-properties improvement

## Scope

The existing `/admin/bookings/calendar` route is retained. It now opens in an all-properties, read-only reservation timeline by default; selecting a row opens the established single-property month/year calendar.

## Audit findings

- The previous page always selected the first listing and called `getAdminCalendarData(listingId, month)`, so it could not represent the portfolio view.
- The previous API required `listingId`, despite the calendar already using the authoritative booking and listing availability data.
- The host workspace already treated a booking as unavailable when it is confirmed or when it is a non-expired pending request. The admin all-properties query deliberately uses that same rule rather than creating another availability engine.
- The existing booking-details API is protected at `/api/v1/admin/bookings/[id]`; there is no matching protected details page. Calendar preview actions therefore link to the existing All Bookings screen with the booking ID as its server-side search value.

## Implementation

- `GET /api/v1/admin/bookings/calendar` preserves its original response when `listingId` (or compatibility alias `propertyId`) is supplied.
- Without a listing ID it accepts `startDate`, `endDate`, `page`, `limit`, `search`, `hostId`, `city`, `country`, `status`, `propertyType`, and `bookingStatus`.
- The endpoint clamps the page size to 50, validates a maximum 62-day window, fetches one paginated listing page, then retrieves overlapping bookings for those listing IDs in one query. This avoids an N+1 bookings query per property.
- The client supports 7-day, 14-day, and month ranges; previous/next/today navigation; pages of 10, 20, or 50 properties; search and filters; and URL state for a shareable/back-forward friendly view.
- Confirmed bookings are green, active 24-hour pending holds are amber, and host-blocked dates are shaded. Empty cells remain visibly available.
- Booking previews expose the reference, guest, property, dates, booking state, payment state, and a link to the existing All Bookings detail workflow. All overlays use `ModalOverlay`; their content can scroll independently.
- As a deployment compatibility guard, a database missing the `BookingPayment` table still receives calendar availability without payment rows. Its previews label payment status **Unavailable** until the existing `20261010140000_admin_booking_foundation` migration is deployed.
- The portfolio mode intentionally has no bulk availability controls or booking mutations. Administrative cancellation remains available only in the existing single-property view.

## Validation performed

- `npx tsc --noEmit --pretty false` completed successfully after the implementation.
- `node --import tsx --test __tests__/admin-calendar-all-properties.test.ts` verifies the bounded batched endpoint contract and core UI safeguards.

No performance timing or production-scale query results are claimed here; the batching and pagination statements describe the implementation and should be measured against representative production data before setting any performance target.

## Filter UI and option fetching follow-up

### Audit

The previous seven controls were: a free-text all-property search, city, country, host ID, property type, listing status, and booking status. The first five displayed as text-style inputs; the final two were native selects. The free-text property search was replaced with a property selector, whose internal search still covers property ID, title, and location without applying a calendar filter until a property is chosen.

### Implementation

- Added the reusable `SearchableFilterCombobox` component. It provides keyboard navigation, opened-dropdown search, selected-state checkmarks, clear actions, loading/no-results/retry states, load-more pagination, stale-request cancellation, a short in-memory option cache, and adaptive above/below placement.
- Extended the existing `/api/v1/admin/bookings/calendar/listings` endpoint rather than creating a duplicate endpoint. Its typed option modes are `properties`, `hosts`, `cities`, `countries`, and `propertyTypes`; each uses database-backed, server-side searching with a maximum page size of 20.
- Added `filterListingId` to the all-properties calendar query so a selected property uses its stable listing ID without conflicting with the existing `listingId` parameter for the single-property calendar route.
- City, country, and property type options come from distinct non-deleted listing values. Hosts are restricted to users with non-deleted listings. Fixed listing and reservation statuses are local canonical enums.
- Selection changes clear only their own URL parameter, reset property pagination, retain date range and all other filters, and use the same batched all-properties calendar request. The Clear all action resets all seven filters.

### Validation

- `npx tsc --noEmit --pretty false` passed.
- Scoped ESLint for the changed calendar UI/API files passed.
- `node --import tsx --test __tests__/admin-calendar-all-properties.test.ts` passed 3/3 tests.
