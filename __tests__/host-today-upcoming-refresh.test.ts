import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Host Today client-side tab loading", () => {
  it("loads only the active reservation tab", () => {
    const workspace = read("components/host/host-today-workspace.tsx");
    const route = read("app/api/v1/host/workspace/route.ts");

    assert.match(workspace, /\/api\/v1\/host\/workspace\?includeCancelled=1/);
    assert.doesNotMatch(workspace, /setInterval\(refreshWhenVisible/);
    assert.doesNotMatch(workspace, /homyz:reservations-updated/);
    assert.match(workspace, /force: true/);
    assert.match(workspace, /showSkeleton: true/);
    assert.ok(
      workspace.indexOf("const viewRequestId = ++viewRequestIdRef.current")
        < workspace.indexOf("if (!options?.force && cacheRef.current.has(cacheKey))"),
      "cache hits must invalidate older in-flight tab requests",
    );
    assert.doesNotMatch(workspace, /Showing the last available data/);
    assert.doesNotMatch(workspace, /refreshError|host_today_refresh_error/);
    assert.doesNotMatch(workspace, /setReservations\(\[\]\)/);
    assert.match(route, /requireApiRole\(request, \[Role\.HOST, Role\.ADMIN\]\)/);
    assert.match(route, /getHostWorkspace\(actor/);
  });

  it("renders distinct final-data empty states without clearing filters", () => {
    const workspace = read("components/host/host-today-workspace.tsx");

    assert.match(workspace, /No reservations today/);
    assert.match(workspace, /No upcoming reservations/);
    assert.match(workspace, /No reservations found for this property/);
    assert.match(workspace, /View calendar/);
    assert.match(workspace, /displayedEvents\.length/);
  });

  it("continues to use canonical date utilities and stable operational event IDs", () => {
    const events = read("lib/booking/host-reservation-events.ts");
    const workspace = read("components/host/host-today-workspace.tsx");

    assert.match(events, /formatBookingDateRange/);
    assert.match(events, /new Map<string, HostReservation>/);
    assert.match(events, /id: `\$\{booking\.id\}:checkout`/);
    assert.match(workspace, /key=\{event\.id\}/);
  });
});
