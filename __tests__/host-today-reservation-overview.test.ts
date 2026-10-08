import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { buildHostReservationQuery } from "../services/host-workspace.service";
import { bookingDateKey } from "../lib/booking/booking-date";
import { BookingStatus } from "../generated/prisma/enums";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Host Today reservation overview — 7 tabs, pagination, and API audit", () => {
  const listingIds = ["listing-1", "listing-2"];
  const now = new Date("2026-10-08T12:00:00.000Z");
  const todayKey = bookingDateKey(now);
  const todayDate = new Date(`${todayKey}T00:00:00.000Z`);

  it("1. builds accurate server query for 'today' tab with deterministic sorting", () => {
    const query = buildHostReservationQuery({
      listingIds,
      tab: "today",
      includeCancelled: true,
      now,
    });

    assert.deepEqual(query.orderBy, [
      { startDate: "asc" },
      { endDate: "asc" },
      { id: "asc" },
    ]);
    assert.ok(query.where.listingId);
    assert.deepEqual(query.where.listingId, { in: listingIds });
    assert.ok(Array.isArray(query.where.OR));
  });

  it("2. builds accurate server query for 'upcoming' tab with future start dates", () => {
    const query = buildHostReservationQuery({
      listingIds,
      tab: "upcoming",
      includeCancelled: true,
      now,
    });

    assert.deepEqual(query.orderBy, [
      { startDate: "asc" },
      { createdAt: "asc" },
      { id: "asc" },
    ]);
    assert.deepEqual(query.where.listingId, { in: listingIds });
  });

  it("3. builds accurate server query for 'staying' tab with active stay bounds", () => {
    const query = buildHostReservationQuery({
      listingIds,
      tab: "staying",
      includeCancelled: true,
      now,
    });

    assert.equal(query.where.status, BookingStatus.CONFIRMED);
    assert.deepEqual(query.where.startDate, { lte: todayDate });
    assert.deepEqual(query.where.endDate, { gt: todayDate });
    assert.deepEqual(query.orderBy, [{ startDate: "asc" }, { id: "asc" }]);
  });

  it("4. builds accurate server query for 'completed' tab", () => {
    const query = buildHostReservationQuery({
      listingIds,
      tab: "completed",
      includeCancelled: true,
      now,
    });

    assert.equal(query.where.status, BookingStatus.CONFIRMED);
    assert.deepEqual(query.where.endDate, { lte: todayDate });
    assert.deepEqual(query.orderBy, [{ endDate: "desc" }, { id: "asc" }]);
  });

  it("5. builds accurate server query for 'pending' tab with non-expired window", () => {
    const query = buildHostReservationQuery({
      listingIds,
      tab: "pending",
      includeCancelled: true,
      now,
    });

    assert.equal(query.where.status, BookingStatus.PENDING);
    assert.ok(query.where.createdAt);
    assert.deepEqual(query.orderBy, [{ createdAt: "asc" }, { id: "asc" }]);
  });

  it("6. builds accurate server query for 'cancelled' tab", () => {
    const query = buildHostReservationQuery({
      listingIds,
      tab: "cancelled",
      includeCancelled: true,
      now,
    });

    assert.equal(query.where.status, BookingStatus.CANCELLED);
    assert.deepEqual(query.orderBy, [{ endDate: "desc" }, { id: "asc" }]);
  });

  it("7. builds accurate server query for 'all' tab with confirmed, cancelled, and pending", () => {
    const query = buildHostReservationQuery({
      listingIds,
      tab: "all",
      includeCancelled: true,
      now,
    });

    assert.ok(Array.isArray(query.where.OR));
    assert.deepEqual(query.orderBy, [{ endDate: "desc" }, { id: "asc" }]);
  });

  it("8. scopes property filtering strictly to the host's listings", () => {
    const singleQuery = buildHostReservationQuery({
      listingIds,
      propertyId: "listing-1",
      tab: "today",
      includeCancelled: true,
      now,
    });
    assert.equal(singleQuery.where.listingId, "listing-1");

    // Foreign listing ID falls back to all owned listing IDs (unauthorized property guard)
    const unauthorizedQuery = buildHostReservationQuery({
      listingIds,
      propertyId: "foreign-listing",
      tab: "today",
      includeCancelled: true,
      now,
    });
    assert.deepEqual(unauthorizedQuery.where.listingId, { in: listingIds });
  });

  it("9. API route supports tab, page, limit, and propertyId query parameters", () => {
    const route = read("app/api/v1/host/workspace/route.ts");
    assert.match(route, /searchParams\.get\("tab"\)/);
    assert.match(route, /searchParams\.has\("page"\)/);
    assert.match(route, /searchParams\.has\("limit"\)/);
    assert.match(route, /searchParams\.get\("propertyId"\)/);
    assert.match(route, /getHostWorkspace\(actor, \{ includeCancelled \}\)/);
  });

  it("10. workspace component integrates tab switching, caching, and simple Previous/Next pagination", () => {
    const workspace = read("components/host/host-today-workspace.tsx");

    // All seven tabs defined in switcher
    assert.match(workspace, /"today"/);
    assert.match(workspace, /"upcoming"/);
    assert.match(workspace, /"staying"/);
    assert.match(workspace, /"completed"/);
    assert.match(workspace, /"pending"/);
    assert.match(workspace, /"cancelled"/);
    assert.match(workspace, /"all"/);

    // Pagination controls & label
    assert.match(workspace, /Page <span/);
    assert.match(workspace, /Previous/);
    assert.match(workspace, /Next/);
    assert.match(workspace, /handlePageChange/);

    // Fast tab switching & caching
    assert.match(workspace, /handleTabChange/);
    assert.match(workspace, /cacheRef/);
    assert.match(workspace, /inFlightRef/);
    assert.match(workspace, /abortControllerRef/);

    // Correct headline count
    assert.match(workspace, /You have \{totalCount\}/);
  });

  it("11. page SSR forwards initial tab, page, and listing to getHostWorkspace and HostTodayWorkspace", () => {
    const page = read("app/(protected)/host/today/page.tsx");

    assert.match(page, /searchParams/);
    assert.match(page, /initialTab/);
    assert.match(page, /initialPage/);
    assert.match(page, /initialPropertyId/);
    assert.match(page, /getHostWorkspace\(actor/);
    assert.match(page, /initialTab=\{initialTab\}/);
    assert.match(page, /initialPage=\{initialPage\}/);
  });
});
