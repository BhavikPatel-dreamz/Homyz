import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Host Today upcoming refresh integration", () => {
  it("refreshes one authenticated workspace source conservatively", () => {
    const workspace = read("components/host/host-today-workspace.tsx");
    const route = read("app/api/v1/host/workspace/route.ts");

    assert.match(workspace, /fetch\("\/api\/v1\/host\/workspace\?includeCancelled=1"/);
    assert.match(workspace, /60_000/);
    assert.match(workspace, /document\.visibilityState === "visible"/);
    assert.match(workspace, /window\.addEventListener\("focus"/);
    assert.match(workspace, /homyz:reservations-updated/);
    assert.match(workspace, /Showing the last available data/);
    assert.doesNotMatch(workspace, /setReservations\(\[\]\)/);
    assert.match(route, /requireApiRole\(request, \[Role\.HOST, Role\.ADMIN\]\)/);
    assert.match(route, /getHostWorkspace\(actor, \{ includeCancelled \}\)/);
  });

  it("renders distinct final-data empty states without clearing filters", () => {
    const workspace = read("components/host/host-today-workspace.tsx");

    assert.match(workspace, /No reservations today/);
    assert.match(workspace, /No upcoming reservations/);
    assert.match(workspace, /No reservations found for this property/);
    assert.match(workspace, /View calendar/);
    assert.match(workspace, /displayedEvents\.length/);
  });

  it("continues to use canonical date utilities and stable booking IDs", () => {
    const events = read("lib/booking/host-reservation-events.ts");
    const workspace = read("components/host/host-today-workspace.tsx");

    assert.match(events, /formatBookingDateRange/);
    assert.match(events, /new Map<string, HostReservation>/);
    assert.match(workspace, /key=\{event\.booking\.id\}/);
  });
});
