# Homyz Admin Booking Management — Phase 7: Reservation Calendar & Availability Synchronization

## 1. Executive Summary

Phase 7 establishes a centralized, authoritative **Admin Reservation Calendar** (`/admin/bookings/calendar`) inside the Homyz Admin Panel. This interface provides administrators with comprehensive visibility into property reservation schedules, pending booking holds, host-blocked calendar dates, and nightly pricing rates across any listing on the platform.

Crucially, the Admin Reservation Calendar does not create a divergent or synthetic availability engine; it consumes the **exact same authoritative availability models and rules** as the Guest booking system and the Host Calendar.

---

## 2. Architecture & Authoritative Synchronization

### 2.1 Unified Availability Model

Property availability in Homyz is synchronized across three distinct layers:
1. **Confirmed Reservations (`BookingStatus.CONFIRMED`)**: Active reservations hold their entire date range `[startDate, endDate)`.
2. **Pending Booking Holds (`BookingStatus.PENDING`)**: In accordance with Airbnb-style request-to-book flows, pending reservation requests hold calendar inventory for exactly 24 hours (`REQUEST_EXPIRY_MS = 86_400_000 ms`). If the host does not accept or decline within 24 hours, the hold expires and the calendar dates are released automatically.
3. **Host-Blocked Dates (`Listing.blockedDates`)**: An array of `YYYY-MM-DD` strings representing dates explicitly blocked by the host.
4. **Nightly Pricing & Date Overrides (`Listing.customPrices`)**: Each calendar cell displays the authoritative rate for that date, prioritizing date-specific custom pricing overrides over the base property rate (`listing.price`).

### 2.2 Shared Service Architecture

- **Service Method**: `bookingService.getAdminCalendarData(actor, listingId, monthKey)`
- **Listings Selector**: `bookingService.listPropertiesForAdminCalendar(actor, search, limit)`
- **API Endpoints**:
  - `GET /api/v1/admin/bookings/calendar`: Fetches listing metadata, active bookings, 24h pending holds, blocked dates, and custom prices for the requested month window.
  - `GET /api/v1/admin/bookings/calendar/listings`: Searchable listing selector endpoint supporting real-time autocomplete across property titles, cities, and host names.

---

## 3. UI/UX Implementation Details

### 3.1 Route & Access Control
- **Path**: `/admin/bookings/calendar`
- **Guards**: `requirePageRole([Role.ADMIN])` on the Server Component; `requireApiPermission(req, PERMISSIONS.BOOKINGS_VIEW)` on all calendar API endpoints.

### 3.2 Property Search & Selector
- Displays currently selected listing banner with thumbnail photo, title, location, host name/email, and base nightly rate.
- "Change Property" modal allows administrators to search across all listings in the system with debounced live search.

### 3.3 Monthly Grid View
- Standard 7-column calendar grid (Sunday–Saturday) with UTC-pinned date calculations (`bookingDateKey`, `parseBookingDate`).
- **Date Cells**:
  - Current day highlighted with theme accent badge.
  - Days outside current month dimmed with reduced opacity.
  - Blocked dates styled with distinct diagonal pattern and `🚫 Blocked` indicator.
  - Nightly rate badge rendered in each cell (toggleable).
- **Reservation & Hold Bars**:
  - Confirmed stays: Emerald green bars displaying `👤 [Guest Name] (Confirmed)` with check-in badge.
  - Pending holds: Amber/gold bars displaying `⏳ [Guest Name] (Hold [Hours]h)`.

### 3.4 Year Overview
- 12 mini-calendar month grids displaying full annual availability at a glance.
- Color-coded day markers (green = confirmed booking, gray = blocked date, white = available).
- One-click navigation: Clicking any month jumps directly into that month's detailed Month View.

### 3.5 Reservation Preview Modal
- Outer overlay rendered exclusively with `ModalOverlay` from `@/components/ui/modal-overlay` ensuring reference-counted body scroll lock.
- Modal content scrollable on mobile and desktop viewports without leaking scroll events.
- Displays:
  - Booking Reference and Submission ID.
  - Status badges (Confirmed vs Pending Hold, Instant Book vs Request to Book).
  - Guest and Host profiles (names, emails, phone numbers).
  - Check-in, check-out, duration in nights, guest count.
  - Nightly rate, cleaning fee, total price, and currency.
  - Real-time 24h hold countdown with urgency indicator for holds expiring in < 6 hours.
  - Direct deep link to `/admin/bookings/[id]`.
  - Administrative cancellation button triggering the Phase 8 mutation flow.

### 3.6 Layout-Matched Loading Skeleton
- `app/(protected)/admin/bookings/calendar/loading.tsx` strictly mirrors the header, breadcrumbs, property selector bar, filter pills, weekday header bar, and 35-cell grid dimensions to eliminate Cumulative Layout Shift (CLS).

---

## 4. Verification & Testing

Automated tests in `__tests__/admin-booking-calendar-cancellation-phase7-phase8.test.ts` verify:
1. UTC calendar date consistency across timezones (`parseBookingDate`, `bookingDateKey`, `differenceInBookingNights`).
2. 24-hour pending hold calculation: Active holds retain dates; requests older than 24h are expired and do not block availability.
3. Availability synchronization: Unification of confirmed bookings, active holds, and blocked dates into an authoritative availability state.
4. Date pricing resolution: Correct priority of custom daily overrides over base price.

