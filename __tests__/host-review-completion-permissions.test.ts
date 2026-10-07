import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Host Review Phase 15 — Review Completion & Status Synchronization", () => {
  it("1. successful submission presents confirmation screen with checkmark, confirmation text, and back link", () => {
    const wizard = source("components/host/host-review-introduction.tsx");

    assert.match(wizard, /if \(isSubmitted\) \{/);
    assert.match(wizard, /Review submitted/);
    assert.match(wizard, /Thank you for sharing your feedback about \{context\.guest\.name\}/);
    assert.match(wizard, /Back to reservations/);
    assert.match(wizard, /href=\{returnHref\}/);
  });

  it("2. returnHref preserves completed tab and reservation/listing search parameters", () => {
    const reviewPage = source("app/(protected)/host/reviews/[bookingId]/page.tsx");

    assert.match(
      reviewPage,
      /const returnHref = `\/host\/today\?tab=completed&reservation=\$\{encodeURIComponent\(context\.bookingId\)\}&listing=\$\{encodeURIComponent\(context\.listing\.id\)\}`;/,
    );
  });

  it("3. cleans up draft in sessionStorage on successful submission", () => {
    const wizard = source("components/host/host-review-introduction.tsx");

    assert.match(wizard, /window\.sessionStorage\.removeItem\(draftKey\);/);
  });

  it("4. notifies workspace and other open tabs via homyz:reservations-updated event and localStorage", () => {
    const wizard = source("components/host/host-review-introduction.tsx");

    assert.match(wizard, /window\.localStorage\.setItem\("homyz:reservations-updated", Date\.now\(\)\.toString\(\)\);/);
    assert.match(wizard, /window\.dispatchEvent\(new Event\("homyz:reservations-updated"\)\);/);
  });

  it("5. workspace responds to homyz:reservations-updated and multi-tab storage events to trigger refresh", () => {
    const workspace = source("components/host/host-today-workspace.tsx");

    assert.match(workspace, /window\.addEventListener\("homyz:reservations-updated", refreshWhenVisible\);/);
    assert.match(workspace, /const onStorage = \(event: StorageEvent\) => \{/);
    assert.match(workspace, /if \(event\.key === "homyz:reservations-updated"\) \{/);
    assert.match(workspace, /void refreshReservations\(\);/);
    assert.match(workspace, /window\.addEventListener\("storage", onStorage\);/);
  });

  it("6. workspace synchronizes active tab when URL requestedTab query changes", () => {
    const workspace = source("components/host/host-today-workspace.tsx");

    assert.match(workspace, /const requestedTab = searchParams\.get\("tab"\);/);
    assert.match(workspace, /useEffect\(\(\) => \{/);
    assert.match(workspace, /requestedTab === "completed"/);
    assert.match(workspace, /setTab\(requestedTab\);/);
  });

  it("7. completed reservation card displays 'Review submitted ✓' badge in emerald", () => {
    const card = source("components/host/reservation-card.tsx");

    assert.match(card, /booking\.hostReview\?\.status === "REVIEW_SUBMITTED"/);
    assert.match(card, /"Review submitted ✓"/);
    assert.match(card, /booking\.hostReview\?\.status === "REVIEW_SUBMITTED"\s*\?\s*"font-semibold text-emerald-700"/);
  });

  it("8. reservation card accurately distinguishes all host review states", () => {
    const card = source("components/host/reservation-card.tsx");

    assert.match(card, /booking\.hostReview\?\.status === "REVIEW_WINDOW_EXPIRED"/);
    assert.match(card, /"Review expired"/);
    assert.match(card, /booking\.hostReview\?\.status === "NOT_ELIGIBLE"/);
    assert.match(card, /"Review unavailable"/);
    assert.match(card, /"Review pending"/);
  });

  it("9. reservation details modal displays 'Review submitted ✓' and suppresses 'Write a review' CTA", () => {
    const shared = source("components/host/host-workspace-shared.tsx");

    assert.match(shared, /status === "REVIEW_SUBMITTED"\s*\?\s*\(/);
    assert.match(shared, /Review submitted ✓/);
    assert.match(shared, /text-emerald-700/);
    // Write a review is only in isPending
    assert.match(shared, /\{isPending \? \([\s\S]*?Write a review[\s\S]*?\) : status === "REVIEW_SUBMITTED"/);
  });

  it("10. reservation details modal provides lazy-loaded 'View review' read-only details", () => {
    const shared = source("components/host/host-workspace-shared.tsx");

    assert.match(shared, /bookingId && !review && \(/);
    assert.match(shared, /onClick=\{\(\) => void loadReview\(\)\}/);
    assert.match(shared, /View review/);
    assert.match(shared, /\/api\/v1\/host\/reviews\?bookingId=\$\{encodeURIComponent\(bookingId\)\}/);
  });

  it("11. view review displays all submitted fields (ratings, recommendation, public review, private note)", () => {
    const shared = source("components/host/host-workspace-shared.tsx");

    assert.match(shared, /Cleanliness: \{review\.cleanlinessRating\}\/5/);
    assert.match(shared, /House rules: \{review\.houseRulesRating\}\/5/);
    assert.match(shared, /Communication: \{review\.communicationRating\}\/5/);
    assert.match(shared, /Recommended: \{review\.recommendGuest \? "Yes" : "No"\}/);
    assert.match(shared, /\{review\.publicReview && \(/);
    assert.match(shared, /\{review\.privateNote && \(/);
    assert.match(shared, /Private note to guest:/);
  });

  it("12. review page prevents re-entry and shows non-editable notice when review is already submitted", () => {
    const reviewPage = source("app/(protected)/host/reviews/[bookingId]/page.tsx");

    assert.match(reviewPage, /context\.eligibility\.eligible \? \(/);
    assert.match(reviewPage, /context\.eligibility\.status === "REVIEW_SUBMITTED"\s*\?\s*"Review submitted"/);
    assert.match(reviewPage, /Back to reservations/);
  });
});

describe("Host Review Phase 16 — Permissions & Visibility", () => {
  it("1. GET /api/v1/host/reviews rejects unauthenticated requests with 401 Unauthorized", () => {
    const route = source("app/api/v1/host/reviews/route.ts");

    assert.match(route, /const actor = await getSessionUser\(\);/);
    assert.match(route, /if \(!actor\) throw AppError\.unauthorized\(\);/);
  });

  it("2. GET /api/v1/host/reviews requires bookingId or guestId parameter", () => {
    const route = source("app/api/v1/host/reviews/route.ts");

    assert.match(route, /const bookingId = req\.nextUrl\.searchParams\.get\("bookingId"\)\?\.trim\(\);/);
    assert.match(route, /const guestId = req\.nextUrl\.searchParams\.get\("guestId"\)\?\.trim\(\);/);
    assert.match(route, /throw AppError\.badRequest\("bookingId or guestId parameter is required"\);/);
  });

  it("3. author host has full visibility into submitted review including privateNote", () => {
    const service = source("services/host-review.service.ts");

    assert.match(service, /const isAuthor = actor\.id === review\.hostId;/);
    assert.match(service, /const privateNote = \(isAuthor \|\| isSubject\) \? review\.privateNote : null;/);
  });

  it("4. subject guest has full visibility into received review including privateNote", () => {
    const service = source("services/host-review.service.ts");

    assert.match(service, /const isSubject = actor\.id === review\.guestId;/);
    assert.match(service, /const privateNote = \(isAuthor \|\| isSubject\) \? review\.privateNote : null;/);
  });

  it("5. other hosts can view ratings, public review, and recommendation, but privateNote is strictly redacted to null", () => {
    const service = source("services/host-review.service.ts");

    assert.match(service, /const isOtherHostOrAdmin = actor\.role === "HOST" \|\| actor\.role === "ADMIN";/);
    assert.match(service, /if \(!isAuthor && !isSubject && !isOtherHostOrAdmin\) \{/);
    assert.match(service, /throw AppError\.forbidden\("You do not have permission to view this review"\);/);
  });

  it("6. guest review history endpoint redacts privateNote for third-party host inquiries", () => {
    const service = source("services/host-review.service.ts");

    assert.match(service, /getHostGuestReviewsForGuest\(/);
    assert.match(service, /privateNote: \(actor\.id === r\.hostId \|\| actor\.id === r\.guestId\) \? r\.privateNote : null/);
  });

  it("7. guest review history endpoint forbids access to non-hosts and non-subject callers", () => {
    const service = source("services/host-review.service.ts");

    assert.match(service, /const isSubject = actor\.id === guestId;/);
    assert.match(service, /const isHostOrAdmin = actor\.role === "HOST" \|\| actor\.role === "ADMIN";/);
    assert.match(service, /if \(!isSubject && !isHostOrAdmin\) \{/);
    assert.match(service, /throw AppError\.forbidden\("You do not have permission to view reviews for this guest"\);/);
  });

  it("8. immutability guarantee: no PUT, PATCH, or DELETE route exists on host reviews API", () => {
    const route = source("app/api/v1/host/reviews/route.ts");

    assert.doesNotMatch(route, /export const PUT/);
    assert.doesNotMatch(route, /export const PATCH/);
    assert.doesNotMatch(route, /export const DELETE/);
  });

  it("9. prevents duplicate submission with database constraint and 409 Conflict", () => {
    const service = source("services/host-review.service.ts");

    assert.match(service, /throw AppError\.conflict\("A review has already been submitted for this reservation\."\);/);
  });

  it("10. IDOR protection: host review submission verifies caller owns or co-hosts the listing", () => {
    const service = source("services/host-review.service.ts");

    assert.match(service, /const \{ items: listings \} = await listingService\.listForHost\(actor, \{ take: null \}\);/);
    assert.match(service, /listingId: \{ in: listingIds \}/);
  });

  it("11. public listing review API never exposes HostGuestReview or guest ratings", () => {
    const publicRoute = source("app/api/v1/listings/[id]/reviews/route.ts");

    assert.doesNotMatch(publicRoute, /HostGuestReview/i);
    assert.doesNotMatch(publicRoute, /recommendGuest/);
  });

  it("12. database model isolates HostGuestReview from property reviews (Review)", () => {
    const schema = source("prisma/schema.prisma");

    assert.match(schema, /model HostGuestReview \{/);
    assert.match(schema, /model Review \{/);
    assert.match(schema, /bookingId\s+String\s+@unique/);
  });
});

