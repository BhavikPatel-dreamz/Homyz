import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = process.cwd();

test("admin calendar defaults to a bounded, paginated all-properties query", async () => {
  const route = await readFile(`${root}/app/api/v1/admin/bookings/calendar/route.ts`, "utf8");
  const service = await readFile(`${root}/services/booking.service.ts`, "utf8");

  assert.match(route, /parsePagination\(searchParams, \{ defaultLimit: 20, maxLimit: 50 \}\)/);
  assert.match(route, /getAdminAllPropertiesCalendarData/);
  assert.doesNotMatch(route, /listingId query parameter is required/);
  assert.match(service, /listingId: \{ in: listingIds \}/);
  assert.match(service, /take: limit/);
  assert.match(service, /Calendar range must be greater than zero and no longer than 62 days/);
  assert.match(service, /status: BookingStatus\.PENDING, createdAt: \{ gt: expiryThreshold \}/);
  assert.match(service, /isMissingBookingPaymentTable/);
  assert.match(service, /include: \{ user \}/);
  assert.match(service, /Payment-status filtering is unavailable until the BookingPayment migration is applied/);
  assert.match(service, /payments: b\.payments \|\| \[\]/);
});

test("calendar UI keeps all-properties read-only and preserves calendar state in URLs", async () => {
  const allProperties = await readFile(
    `${root}/app/(protected)/admin/bookings/calendar/admin-all-properties-calendar.tsx`,
    "utf8",
  );
  const singleProperty = await readFile(
    `${root}/app/(protected)/admin/bookings/calendar/admin-calendar-client.tsx`,
    "utf8",
  );

  assert.match(allProperties, /Admin view only — availability changes are managed by hosts/);
  assert.match(allProperties, /params\.set\("view", "all"\)/);
  assert.match(allProperties, /SearchableFilterCombobox/);
  assert.match(allProperties, /filterListingId/);
  assert.match(allProperties, /Clear all/);
  assert.match(allProperties, /loadFilterOptions\("properties"/);
  assert.match(allProperties, /payload\.data \|\| payload/);
  assert.match(allProperties, /data\?\.pagination\?\.page/);
  assert.match(allProperties, /<ModalOverlay/);
  assert.match(allProperties, /option value="50">50/);
  assert.match(singleProperty, /returnToAllProperties/);
  assert.match(singleProperty, /params\.set\("calendarView", nextView\)/);
});

test("calendar filter options are paginated, database-backed, and searchable", async () => {
  const service = await readFile(`${root}/services/booking.service.ts`, "utf8");
  const route = await readFile(`${root}/app/api/v1/admin/bookings/calendar/listings/route.ts`, "utf8");
  const combobox = await readFile(`${root}/components/ui/searchable-filter-combobox.tsx`, "utf8");

  assert.match(service, /listAdminCalendarFilterOptions/);
  assert.match(service, /"properties" \| "hosts" \| "cities" \| "countries" \| "propertyTypes"/);
  assert.match(service, /limit = Math\.min\(20/);
  assert.match(route, /searchParams\.get\("type"\)/);
  assert.match(combobox, /Load more/);
  assert.match(combobox, /Could not load options\. Retry/);
  assert.match(combobox, /onKeyDown/);
});
