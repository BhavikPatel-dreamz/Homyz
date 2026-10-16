import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  buildOperationalEvents,
  filterOperationalEventsByProperty,
  deduplicateHostReservations,
  selectPriorityReservationId,
} from "../lib/booking/host-reservation-events";
import type { HostReservation } from "../components/host/host-workspace-shared";
import type { ListingDTO } from "../services/mappers";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

function reservation(
  id: string,
  listingId: string,
  startDate: string,
  endDate: string,
): HostReservation {
  return {
    id,
    listingId,
    status: "CONFIRMED",
    startDate,
    endDate,
    createdAt: "2026-09-01T00:00:00.000Z",
    guestName: id,
    guestImage: null,
    guests: 1,
  };
}

function listing(id: string, checkInStart: string, checkOutTime = "11:00"): ListingDTO {
  return {
    id,
    title: id,
    city: "Riyadh",
    district: "Al Olaya",
    country: "Saudi Arabia",
    photos: [],
    checkInStart,
    checkOutTime,
  } as unknown as ListingDTO;
}

describe("Host Today priority and property filters", () => {
  const today = "2026-10-01";

  it("selects the nearest future event today after earlier events have passed", () => {
    const listings = new Map([
      ["nine", listing("nine", "15:00", "09:00")],
      ["noon", listing("noon", "12:00")],
      ["three", listing("three", "15:00")],
    ]);
    const events = buildOperationalEvents([
      reservation("checkout-9", "nine", "2026-09-29", today),
      reservation("checkin-12", "noon", today, "2026-10-03"),
      reservation("checkin-15", "three", today, "2026-10-04"),
    ], listings, "today", today);

    assert.deepEqual(events.map((event) => event.timeMinutes), [540, 720, 900]);
    assert.equal(selectPriorityReservationId(events, "today", 11 * 60), "checkin-12");
  });

  it("prioritizes an active stay, then the first chronological upcoming reservation", () => {
    const property = listing("property", "15:00");
    const listings = new Map([[property.id, property]]);
    const todayEvents = buildOperationalEvents([
      reservation("active-stay", property.id, "2026-09-30", "2026-10-02"),
      reservation("later-checkin", property.id, today, "2026-10-03"),
    ], listings, "today", today);
    const upcomingEvents = buildOperationalEvents([
      reservation("oct-15", property.id, "2026-10-15", "2026-10-17"),
      reservation("oct-05", property.id, "2026-10-05", "2026-10-07"),
      reservation("oct-08", property.id, "2026-10-08", "2026-10-10"),
    ], listings, "upcoming", today);

    assert.equal(selectPriorityReservationId(todayEvents, "today", 14 * 60), "active-stay");
    assert.equal(selectPriorityReservationId(upcomingEvents, "upcoming", 0), "oct-05");
  });

  it("derives count, cards, and priority from the same single-property result", () => {
    const propertyA = listing("property-a", "10:00");
    const propertyB = listing("property-b", "11:00");
    const listings = new Map([
      [propertyA.id, propertyA],
      [propertyB.id, propertyB],
    ]);
    const allEvents = buildOperationalEvents([
      reservation("a", propertyA.id, today, "2026-10-03"),
      reservation("b", propertyB.id, today, "2026-10-03"),
    ], listings, "today", today);
    const visibleEvents = filterOperationalEventsByProperty(allEvents, propertyB.id);

    assert.equal(visibleEvents.length, 1);
    assert.equal(visibleEvents[0].booking.id, "b");
    assert.equal(selectPriorityReservationId(visibleEvents, "today", 9 * 60), "b");
    assert.deepEqual(filterOperationalEventsByProperty(allEvents, "no-results"), []);
    assert.equal(filterOperationalEventsByProperty(allEvents, null), allEvents);
  });

  it("deduplicates refreshed reservations by canonical booking ID", () => {
    const original = reservation("same-booking", "property-a", today, "2026-10-03");
    const refreshed = { ...original, guests: 3 };
    const deduplicated = deduplicateHostReservations([original, refreshed]);

    assert.equal(deduplicated.length, 1);
    assert.equal(deduplicated[0].guests, 3);
  });

  it("uses radio draft/apply controls, the existing menu, and a session-scoped provider", () => {
    const workspace = read("components/host/host-today-workspace.tsx");
    const subNav = read("components/host/host-sub-nav.tsx");
    const protectedShell = read("app/(protected)/protected-shell.tsx");
    const dialog = read("components/host/host-workspace-shared.tsx");

    assert.match(workspace, /draftPropertyId/);
    assert.match(workspace, /selectedPropertyId/);
    assert.match(workspace, /type="radio"/);
    assert.doesNotMatch(workspace, /type="checkbox"/);
    assert.match(workspace, /All properties/);
    assert.match(workspace, /setSelectedPropertyId\(null\)/);
    assert.match(subNav, /homyz:toggle-menu/);
    assert.match(protectedShell, /HostDashboardStateProvider/);
    assert.match(dialog, /h-dvh max-h-dvh rounded-none/);
  });

  it("keeps reservation ownership constrained to authenticated host listing IDs", () => {
    const service = read("services/host-workspace.service.ts");
    assert.match(service, /listingService\.listForHost\(actor/);
    assert.match(service, /listingId: \{ in: listingIds \}/);
  });
});
