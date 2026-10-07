import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { buildOperationalEvents } from "../lib/booking/host-reservation-events";
import type { HostReservation } from "../components/host/host-workspace-shared";
import type { ListingDTO } from "../services/mappers";

const root = path.resolve(import.meta.dirname, "..");

function reservation(
  overrides: Partial<HostReservation> & Pick<HostReservation, "id" | "listingId">,
): HostReservation {
  return {
    status: "CONFIRMED",
    startDate: "2026-10-01",
    endDate: "2026-10-03",
    createdAt: "2026-09-01T00:00:00.000Z",
    guestName: "Guest",
    guestImage: null,
    guests: 1,
    ...overrides,
  };
}

function listing(
  id: string,
  overrides: Partial<ListingDTO> = {},
): ListingDTO {
  return {
    id,
    title: `Listing ${id}`,
    city: "Riyadh",
    district: "Al Olaya",
    country: "Saudi Arabia",
    photos: [],
    checkInStart: "15:00",
    checkOutTime: "11:00",
    ...overrides,
  } as ListingDTO;
}

describe("Host Today reservation core flow", () => {
  const today = "2026-10-01";
  const firstListing = listing("listing-a", {
    title: "Riyadh Loft",
    checkInStart: "16:30",
    checkOutTime: "10:15",
  });
  const secondListing = listing("listing-b", { title: "Jeddah Villa" });
  const listings = new Map([
    [firstListing.id, firstListing],
    [secondListing.id, secondListing],
  ]);

  it("derives today's check-in, checkout, and active-stay events with listing times", () => {
    const events = buildOperationalEvents([
      reservation({ id: "check-in", listingId: "listing-a", startDate: today }),
      reservation({
        id: "checkout",
        listingId: "listing-a",
        startDate: "2026-09-28",
        endDate: today,
      }),
      reservation({
        id: "staying",
        listingId: "listing-b",
        startDate: "2026-09-30",
        endDate: "2026-10-02",
      }),
    ], listings, "today", today);

    assert.deepEqual(events.map((event) => event.eventType), ["checkout", "staying", "checkin"]);
    assert.equal(events[0].timeDisplay, "10:15 AM");
    assert.equal(events[0].subtitleDisplay, "Guest checks out");
    assert.equal(events[2].timeDisplay, "4:30 PM");
    assert.equal(events[2].subtitleDisplay, "Guest checks in");
  });

  it("shows only future starts under Upcoming and preserves exact booking dates", () => {
    const events = buildOperationalEvents([
      reservation({ id: "today", listingId: "listing-a", startDate: today }),
      reservation({
        id: "future",
        listingId: "listing-b",
        startDate: "2026-10-12",
        endDate: "2026-10-14",
      }),
    ], listings, "upcoming", today);

    assert.equal(events.length, 1);
    assert.equal(events[0].booking.id, "future");
    assert.equal(events[0].subtitleDisplay, "Guest checks in");
    assert.equal(events[0].dateDisplay, "Oct 12 – Oct 14, 2026");
    assert.equal(events[0].listing.title, "Jeddah Villa");
  });

  it("excludes cancelled and unknown terminal statuses", () => {
    const events = buildOperationalEvents([
      reservation({ id: "confirmed", listingId: "listing-a" }),
      reservation({ id: "cancelled", listingId: "listing-a", status: "CANCELLED" }),
      reservation({ id: "rejected", listingId: "listing-a", status: "REJECTED" }),
      reservation({ id: "expired", listingId: "listing-a", status: "EXPIRED" }),
    ], listings, "today", today);

    assert.deepEqual(events.map((event) => event.booking.id), ["confirmed"]);
  });

  it("keeps card count and listing filtering on the same event source", () => {
    const events = buildOperationalEvents([
      reservation({ id: "a", listingId: "listing-a" }),
      reservation({ id: "b", listingId: "listing-b" }),
    ], listings, "today", today);
    const selectedListingEvents = events.filter(
      (event) => event.booking.listingId === "listing-a",
    );

    assert.equal(events.length, 2);
    assert.equal(selectedListingEvents.length, 1);
    assert.equal(selectedListingEvents[0].listing.title, "Riyadh Loft");
  });

  it("uses one server fetch and client-only tab filtering with a reusable card", () => {
    const page = fs.readFileSync(
      path.join(root, "app/(protected)/host/today/page.tsx"),
      "utf8",
    );
    const workspace = fs.readFileSync(
      path.join(root, "components/host/host-today-workspace.tsx"),
      "utf8",
    );
    const card = fs.readFileSync(
      path.join(root, "components/host/reservation-card.tsx"),
      "utf8",
    );

    assert.equal(page.match(/getHostWorkspace\(/g)?.length, 1);
    assert.match(page, /today=\{today\}/);
    assert.match(workspace, /buildOperationalEvents\(reservations, listingsMap, tab, currentDate, currentTimeMinutes\)/);
    assert.match(workspace, /<ReservationCard/);
    assert.equal(workspace.match(/fetch\("\/api\/v1\/host\/workspace\?includeCancelled=1"/g)?.length, 1);
    assert.match(card, /PropertyPhoto/);
    assert.match(card, /guestCount/);
  });
});
