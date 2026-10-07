import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function source(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("Host completed reservation review integration", () => {
  it("loads lightweight, independent host and guest review status with the workspace query", () => {
    const workspace = source("services/host-workspace.service.ts");

    assert.match(workspace, /hostGuestReview:\s*\{/);
    assert.match(workspace, /reviews:\s*\{[\s\S]*?where: \{ status: ReviewStatus\.PUBLISHED \}/);
    assert.match(workspace, /status: b\.reviews\.length > 0 \? "RECEIVED" as const : "PENDING" as const/);
    assert.match(workspace, /hasHostReview: Boolean\(b\.hostGuestReview\)/);
  });

  it("shows compact completed-card status without replacing the reservation card action", () => {
    const card = source("components/host/reservation-card.tsx");

    assert.match(card, /event\.eventType === "completed"/);
    assert.match(card, /Review pending/);
    assert.match(card, /Guest reviewed/);
    assert.match(card, /onClick=\{onSelect\}/);
  });

  it("adds an on-demand guest-review section to the existing reservation modal", () => {
    const modal = source("components/host/host-workspace-shared.tsx");

    assert.match(modal, /title="Reservation details"/);
    assert.match(modal, /id="reviews-heading"/);
    assert.match(modal, /Your review of the guest/);
    assert.match(modal, /Guest review of your property/);
    assert.match(modal, /View guest review/);
    assert.match(modal, /reviews\/host\?bookingId=/);
    assert.match(modal, /Private note to host/);
  });

  it("keeps private notes behind a booking-specific authorized endpoint", () => {
    const route = source("app/api/v1/listings/[id]/reviews/host/route.ts");
    const publicRoute = source("app/api/v1/listings/[id]/reviews/route.ts");

    assert.match(route, /where: \{ id: bookingId, listingId: id \}/);
    assert.match(route, /isOwner && !isCoHost && !isReviewAuthor/);
    assert.match(route, /authorId: booking\.userId/);
    assert.match(route, /privateNoteToHost: true/);
    assert.doesNotMatch(publicRoute, /privateNoteToHost: true/);
  });
});
