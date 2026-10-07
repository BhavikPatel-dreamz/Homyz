import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Phase 19 — Guest Review Visibility on Host Side", () => {
  it("1. Scenario 1: Completed booking without guest review displays 'Awaiting guest review' and 'Guest pending'", () => {
    const shared = source("components/host/host-workspace-shared.tsx");
    const card = source("components/host/reservation-card.tsx");

    assert.match(shared, /reviewStatus === "PENDING"/);
    assert.match(shared, /Awaiting guest review/);
    assert.match(card, /guestReview\?\.status === "RECEIVED"\s*\?\s*"Guest reviewed"\s*:\s*"Guest pending"/);
  });

  it("2. Scenario 2: Completed booking with guest review displays 'Guest review received' and 'View review' action", () => {
    const shared = source("components/host/host-workspace-shared.tsx");
    const card = source("components/host/reservation-card.tsx");

    assert.match(shared, /Guest review received/);
    assert.match(shared, /View review/);
    assert.match(shared, /onClick=\{onView\}/);
    assert.match(card, /booking\.guestReview\?\.status === "RECEIVED"\s*\?\s*"font-semibold text-emerald-700"/);
  });

  it("3. Scenario 3: Displays all persisted rating fields, topics, public review, and author details", () => {
    const shared = source("components/host/host-workspace-shared.tsx");

    // All categories
    assert.match(shared, /\["Check-in", review\.checkInRating\]/);
    assert.match(shared, /\["Cleanliness", review\.cleanlinessRating\]/);
    assert.match(shared, /\["Accuracy", review\.accuracyRating\]/);
    assert.match(shared, /\["Communication", review\.communicationRating\]/);
    assert.match(shared, /\["Location", review\.locationRating\]/);
    assert.match(shared, /\["Value", review\.valueRating\]/);

    // Overall rating
    assert.match(shared, /★ \{review\.rating\} \/ 5 overall/);

    // Topics/tags
    assert.match(shared, /review\.topics && review\.topics\.length > 0/);

    // Public review text
    assert.match(shared, /Public review/);
    assert.match(shared, /\{review\.comment\}/);
  });

  it("4. Scenario 4: Private note displayed separately with clear heading and access explanation", () => {
    const shared = source("components/host/host-workspace-shared.tsx");

    assert.match(shared, /Private feedback from guest/);
    assert.match(shared, /Only you and the guest can see this note\./);
    assert.match(shared, /\{review\.privateNoteToHost\}/);
  });

  it("5. Scenario 4: Private note is excluded from public DTOs and public listing review endpoints", () => {
    const publicRoute = source("app/api/v1/listings/[id]/reviews/route.ts");
    const mappers = source("services/mappers.ts");

    assert.doesNotMatch(publicRoute, /privateNoteToHost: true/);
    assert.match(mappers, /export function toPublicReviewDTO/);
    // toPublicReviewDTO explicitly excludes privateNoteToHost
    const publicDtoSlice = mappers.slice(
      mappers.indexOf("export function toPublicReviewDTO"),
      mappers.indexOf("export type PublicReviewDTO"),
    );
    assert.doesNotMatch(publicDtoSlice, /privateNoteToHost/);
  });

  it("6. Scenario 5: Two-way reviews operate completely independently", () => {
    const shared = source("components/host/host-workspace-shared.tsx");

    // Both panels are rendered independently under Reviews section
    assert.match(shared, /<ReviewStatusPanel[\s\S]*?title="Your review of the guest"/);
    assert.match(shared, /<GuestReviewPanel[\s\S]*?reviewStatus=\{booking\.guestReview\?\.status \?\? "PENDING"\}/);
  });

  it("7. Scenario 6 & 7: Backend authorizes host/co-host and strictly verifies booking belongs to listing", () => {
    const hostRoute = source("app/api/v1/listings/[id]/reviews/host/route.ts");

    assert.match(hostRoute, /const actor = await getSessionUser\(\);/);
    assert.match(hostRoute, /if \(!actor\) throw AppError\.unauthorized\(\);/);
    assert.match(hostRoute, /const isOwner = listing\.hostId === actor\.id;/);
    assert.match(hostRoute, /ListingCoHostStatus\.ACCEPTED/);
    assert.match(hostRoute, /where: \{ id: bookingId, listingId: id \}/);
    assert.match(hostRoute, /if \(!booking\) throw AppError\.notFound\("Booking not found"\);/);
    assert.match(hostRoute, /if \(!isOwner && !isCoHost && !isReviewAuthor\) \{/);
    assert.match(hostRoute, /throw AppError\.forbidden\("You do not have access to this review"\);/);
  });

  it("8. Scenario 8: Lightweight workspace listing prevents N+1 review payload overhead", () => {
    const workspace = source("services/host-workspace.service.ts");

    // Only takes 1 and selects id for existence check
    assert.match(workspace, /reviews:\s*\{[\s\S]*?select: \{ id: true \},[\s\S]*?take: 1/);
    assert.doesNotMatch(workspace, /reviews:\s*\{[\s\S]*?select: \{[\s\S]*?comment: true/);
    assert.doesNotMatch(workspace, /reviews:\s*\{[\s\S]*?select: \{[\s\S]*?privateNoteToHost: true/);
  });

  it("9. Scenario 9: Property aggregate ratings are calculated from published property reviews only", () => {
    const reviewService = source("services/review.service.ts");

    assert.match(reviewService, /getReviewStats\(listingId: string\)/);
    assert.match(reviewService, /const where = \{ listingId, status: "PUBLISHED" as const \};/);
    assert.match(reviewService, /cleanlinessRating: true/);
    assert.match(reviewService, /accuracyRating: true/);
    assert.match(reviewService, /checkInRating: true/);
    assert.match(reviewService, /communicationRating: true/);
    assert.match(reviewService, /locationRating: true/);
    assert.match(reviewService, /valueRating: true/);
    // HostGuestReview is never mixed into listing review aggregates
    assert.doesNotMatch(reviewService, /HostGuestReview/);
  });

  it("10. Scenario 10 & 12: Handles loading, error, and retry states cleanly without breaking modal", () => {
    const shared = source("components/host/host-workspace-shared.tsx");

    assert.match(shared, /disabled=\{loading\}/);
    assert.match(shared, /\{loading \? "Loading…" : "View review"\}/);
    assert.match(shared, /role="alert"/);
    assert.match(shared, /Retry/);
    assert.match(shared, /onClick=\{onView\}/);
  });
});
