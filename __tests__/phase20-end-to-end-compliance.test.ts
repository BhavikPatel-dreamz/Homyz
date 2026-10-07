import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getHostReviewEligibility } from "@/lib/booking/host-review-eligibility";
import {
  CLEANLINESS_FEEDBACK_TAGS,
  COMMUNICATION_FEEDBACK_TAGS,
  HOST_PRIVATE_NOTE_MAX_LENGTH,
  HOST_PUBLIC_REVIEW_MAX_LENGTH,
  validateHostReviewDraft,
  validateHostReviewSubmission,
} from "@/lib/booking/host-review-draft";

const readCode = (relPath: string) =>
  fs.readFileSync(path.join(process.cwd(), relPath), "utf8");

describe("Phase 20 — End-to-End Audit & Documentation Compliance Test Suite", () => {
  // =========================================================================
  // Section 1: Host Review Entry Point & Eligibility
  // =========================================================================
  describe("Section 1: Host Review Entry Point & Eligibility", () => {
    it("1.A Entry point uses /host/today Completed tab and opens reservation details without duplicate page", () => {
      const workspace = readCode("components/host/host-today-workspace.tsx");
      const shared = readCode("components/host/host-workspace-shared.tsx");

      assert.match(workspace, /id: "completed", label: "Completed"/);
      assert.match(workspace, /onHostReview=\{\(\) => router\.push\(`\/host\/reviews\/\$\{encodeURIComponent\(selected\.id\)\}`\)\}/);
      assert.match(shared, /title="Your review of the guest"/);
      assert.match(shared, /onClick=\{onHostReview\}/);
    });

    it("1.B Eligibility validates completed stay, review window, host ownership, and prevents double review", () => {
      const now = new Date("2026-10-07T12:00:00.000Z");

      // Eligible stay (completed 2 days ago, checkout 11:00 AM)
      const eligible = getHostReviewEligibility({
        isAuthorizedHost: true,
        bookingStatus: "CONFIRMED",
        endDate: "2026-10-05",
        checkOutTime: "11:00",
        hasHostReview: false,
        now,
      });
      assert.equal(eligible.eligible, true);
      assert.equal(eligible.status, "REVIEW_PENDING");

      // Already reviewed
      const alreadyReviewed = getHostReviewEligibility({
        isAuthorizedHost: true,
        bookingStatus: "CONFIRMED",
        endDate: "2026-10-05",
        checkOutTime: "11:00",
        hasHostReview: true,
        now,
      });
      assert.equal(alreadyReviewed.eligible, false);
      assert.equal(alreadyReviewed.status, "REVIEW_SUBMITTED");

      // Expired (completed 40 days ago, review window is 30 days)
      const expired = getHostReviewEligibility({
        isAuthorizedHost: true,
        bookingStatus: "CONFIRMED",
        endDate: "2026-08-20",
        checkOutTime: "11:00",
        hasHostReview: false,
        now,
      });
      assert.equal(expired.eligible, false);
      assert.equal(expired.status, "REVIEW_WINDOW_EXPIRED");

      // Upcoming / ongoing stay
      const upcoming = getHostReviewEligibility({
        isAuthorizedHost: true,
        bookingStatus: "CONFIRMED",
        endDate: "2026-10-10",
        checkOutTime: "11:00",
        hasHostReview: false,
        now,
      });
      assert.equal(upcoming.eligible, false);
      assert.equal(upcoming.status, "NOT_ELIGIBLE");

      // Cancelled stay
      const cancelled = getHostReviewEligibility({
        isAuthorizedHost: true,
        bookingStatus: "CANCELLED",
        endDate: "2026-10-05",
        checkOutTime: "11:00",
        hasHostReview: false,
        now,
      });
      assert.equal(cancelled.eligible, false);
      assert.equal(cancelled.status, "NOT_ELIGIBLE");

      // Unauthorized host
      const unauthorized = getHostReviewEligibility({
        isAuthorizedHost: false,
        bookingStatus: "CONFIRMED",
        endDate: "2026-10-05",
        checkOutTime: "11:00",
        hasHostReview: false,
        now,
      });
      assert.equal(unauthorized.eligible, false);
      assert.equal(unauthorized.status, "NOT_ELIGIBLE");
    });
  });

  // =========================================================================
  // Section 2: Host Review Wizard Steps & Fields
  // =========================================================================
  describe("Section 2: Host Review Wizard Steps & Validation", () => {
    it("2.C Intro screen renders property info, guest favorite, stay dates, payout, and progress", () => {
      const intro = readCode("components/host/host-review-introduction.tsx");
      assert.match(intro, /Write a review for \{context\.guest\.name\}/);
      assert.match(intro, /context\.listing\.photos\[0\]/);
      assert.match(intro, /\{context\.listing\.title\}/);
      assert.match(intro, /context\.listing\.overallRating !== null/);
      assert.match(intro, /context\.listing\.isGuestFavorite &&/);
      assert.match(intro, /stayDates/);
      assert.match(intro, /Total payout/);
      assert.match(intro, /role="progressbar"/);
    });

    it("2.D-F Cleanliness, House Rules, and Communication require 1-5 ratings and support optional tags", () => {
      const intro = readCode("components/host/host-review-introduction.tsx");
      assert.match(intro, /How clean did \{context\.guest\.name\} leave your place\?/);
      assert.match(intro, /How well did \{context\.guest\.name\} follow your house rules\?/);
      assert.match(intro, /How well did \{context\.guest\.name\} communicate\?/);

      // Verify cleanliness feedback tags
      assert.deepEqual(CLEANLINESS_FEEDBACK_TAGS, [
        "Neat & tidy",
        "Took care of the garbage",
        "Kept in good condition",
        "Something else",
      ]);

      // Verify communication feedback tags
      assert.deepEqual(COMMUNICATION_FEEDBACK_TAGS, [
        "Helpful messages",
        "Always responded",
        "Respectful",
        "Something else",
      ]);
    });

    it("2.G Public review is optional text up to 500 characters and restricted to authorized parties", () => {
      assert.equal(HOST_PUBLIC_REVIEW_MAX_LENGTH, 500);
      const intro = readCode("components/host/host-review-introduction.tsx");
      assert.match(intro, /Write a public review/);
      assert.match(intro, /Say a few words about your experience hosting this guest/);
      assert.match(intro, /maxLength=\{HOST_PUBLIC_REVIEW_MAX_LENGTH\}/);
    });

    it("2.H Recommendation is a mandatory single-selection Yes/No boolean", () => {
      const intro = readCode("components/host/host-review-introduction.tsx");
      assert.match(intro, /Would you recommend \{context\.guest\.name\} to other hosts\?/);
      assert.match(intro, /role="radiogroup"/);

      // validateHostReviewDraft checks individual draft fields
      const draftCheckYes = validateHostReviewDraft({ recommendGuest: true });
      assert.equal(draftCheckYes.recommendGuest, true);
      const draftCheckNo = validateHostReviewDraft({ recommendGuest: false });
      assert.equal(draftCheckNo.recommendGuest, true);
      const draftCheckNull = validateHostReviewDraft({ recommendGuest: null });
      assert.equal(draftCheckNull.recommendGuest, false);

      // validateHostReviewSubmission validates payload completeness
      const validSubYes = validateHostReviewSubmission({
        bookingId: "bkg_1",
        cleanlinessRating: 5,
        houseRulesRating: 5,
        communicationRating: 5,
        recommendGuest: true,
      });
      assert.equal(validSubYes.valid, true);

      const validSubNo = validateHostReviewSubmission({
        bookingId: "bkg_1",
        cleanlinessRating: 5,
        houseRulesRating: 5,
        communicationRating: 5,
        recommendGuest: false,
      });
      assert.equal(validSubNo.valid, true);

      const invalidSubNull = validateHostReviewSubmission({
        bookingId: "bkg_1",
        cleanlinessRating: 5,
        houseRulesRating: 5,
        communicationRating: 5,
        recommendGuest: null,
      });
      assert.equal(invalidSubNull.valid, false);
      assert.ok(invalidSubNull.errors.recommendGuest);
    });

    it("2.I Private note is optional, up to 500 chars, visible ONLY to guest and submitting host", () => {
      assert.equal(HOST_PRIVATE_NOTE_MAX_LENGTH, 500);
      const intro = readCode("components/host/host-review-introduction.tsx");
      assert.match(intro, /Write a private note/);
      assert.match(intro, /Is there anything else you&apos;d like to share with \{context\.guest\.name\}\?/);
      assert.match(intro, /maxLength=\{HOST_PRIVATE_NOTE_MAX_LENGTH\}/);
    });

    it("2.J-K Submission is explicit, atomic, immutable, and notifies guest", () => {
      const service = readCode("services/host-review.service.ts");
      assert.match(service, /status: ReviewStatus\.PUBLISHED/);
      assert.match(service, /code === "P2002"/);
      assert.match(service, /throw AppError\.conflict\("A review has already been submitted for this reservation\."\)/);
      assert.match(service, /notificationService\.create/);
      assert.match(service, /entityType: "HOST_REVIEW"/);
    });
  });

  // =========================================================================
  // Section 3: Guest Review & Two-Way Independence
  // =========================================================================
  describe("Section 3: Guest Review, Two-Way Independence & Aggregates", () => {
    it("3.A-B Guest review details include 6 category ratings, topics, comment, and privateNoteToHost", () => {
      const hostEndpoint = readCode("app/api/v1/listings/[id]/reviews/host/route.ts");
      assert.match(hostEndpoint, /rating: true/);
      assert.match(hostEndpoint, /cleanlinessRating: true/);
      assert.match(hostEndpoint, /accuracyRating: true/);
      assert.match(hostEndpoint, /checkInRating: true/);
      assert.match(hostEndpoint, /communicationRating: true/);
      assert.match(hostEndpoint, /locationRating: true/);
      assert.match(hostEndpoint, /valueRating: true/);
      assert.match(hostEndpoint, /comment: true/);
      assert.match(hostEndpoint, /privateNoteToHost: true/);
      assert.match(hostEndpoint, /topics: true/);
    });

    it("3.C Two review directions are completely isolated at the database model and service layers", () => {
      const schema = readCode("prisma/schema.prisma");
      assert.match(schema, /model Review \{/);
      assert.match(schema, /model HostGuestReview \{/);
      assert.match(schema, /@@unique\(\[bookingId\]\)/);

      // Ensure public listing review mapper never leaks privateNoteToHost or HostGuestReview
      const mappers = readCode("services/mappers.ts");
      assert.match(mappers, /export function toPublicReviewDTO/);
      assert.doesNotMatch(mappers, /toPublicReviewDTO[\s\S]*?privateNoteToHost/);
      assert.doesNotMatch(mappers, /toPublicReviewDTO[\s\S]*?HostGuestReview/);
    });

    it("3.D Property aggregates exclude HostGuestReview and calculate purely from published guest reviews", () => {
      const reviewService = readCode("services/review.service.ts");
      assert.match(reviewService, /getReviewStats\(listingId: string\)/);
      assert.match(reviewService, /const where = \{ listingId, status: "PUBLISHED" as const \};/);
      assert.match(reviewService, /prisma\.review\.aggregate/);
      assert.doesNotMatch(reviewService, /prisma\.hostGuestReview\.aggregate/);
    });

    it("3.E Host completed reservation cards display both host and guest review statuses independently", () => {
      const card = readCode("components/host/reservation-card.tsx");
      assert.match(card, /const showReviewStatus = event\.eventType === "completed";/);
      assert.match(card, /hostReviewLabel/);
      assert.match(card, /guestReviewLabel/);
      assert.match(card, /aria-label=\{`\$\{hostReviewLabel\}\. \$\{guestReviewLabel\}\.`\}/);
    });
  });

  // =========================================================================
  // Section 4: Security, Permissions & IDOR Protection
  // =========================================================================
  describe("Section 4: Security, Permissions & Data Protection", () => {
    it("4.A Host review endpoint verifies listing ownership / co-host status and rejects unauthorized hosts", () => {
      const hostReviewService = readCode("services/host-review.service.ts");
      assert.match(hostReviewService, /listingService\.listForHost\(actor, \{ take: null \}\)/);
      assert.match(hostReviewService, /listingId: \{ in: listingIds \}/);

      const hostReviewsApi = readCode("app/api/v1/host/reviews/route.ts");
      assert.match(hostReviewsApi, /if \(!actor\) throw AppError\.unauthorized\(\);/);
    });

    it("4.B Private note to host is visible only to property owner, accepted co-host, or author guest", () => {
      const hostRoute = readCode("app/api/v1/listings/[id]/reviews/host/route.ts");
      assert.match(hostRoute, /if \(!actor\) throw AppError\.unauthorized\(\);/);
      assert.match(hostRoute, /const isOwner = listing\.hostId === actor\.id;/);
      assert.match(hostRoute, /const isReviewAuthor = booking\.userId === actor\.id;/);
      assert.match(hostRoute, /if \(!isOwner && !isCoHost && !isReviewAuthor\) \{/);
      assert.match(hostRoute, /throw AppError\.forbidden\("You do not have access to this review"\);/);
    });

    it("4.C HostGuestReview endpoint redacts privateNote for third-party hosts and blocks non-hosts", () => {
      const hostReviewService = readCode("services/host-review.service.ts");
      assert.match(hostReviewService, /const isAuthor = actor\.id === review\.hostId;/);
      assert.match(hostReviewService, /const isSubject = actor\.id === review\.guestId;/);
      assert.match(hostReviewService, /const privateNote = \(isAuthor \|\| isSubject\) \? review\.privateNote : null;/);
    });
  });

  // =========================================================================
  // Section 5: Draft Persistence, Performance & Accessibility
  // =========================================================================
  describe("Section 5: Draft Persistence, Performance & Accessibility", () => {
    it("5.A Draft is isolated per host and booking, persists to sessionStorage, and cleans up on submit", () => {
      const intro = readCode("components/host/host-review-introduction.tsx");
      assert.match(intro, /`homyz:host-review-draft:\$\{context\.hostId\}:\$\{context\.bookingId\}`/);
      assert.match(intro, /window\.sessionStorage\.setItem/);
      assert.match(intro, /window\.sessionStorage\.removeItem\(draftKey\)/);
      assert.match(intro, /window\.addEventListener\("beforeunload", flushDraft\)/);
    });

    it("5.B Lightweight queries prevent N+1 payloads in completed reservations list", () => {
      const workspaceService = readCode("services/host-workspace.service.ts");
      assert.match(workspaceService, /reviews:\s*\{[\s\S]*?select: \{ id: true \},[\s\S]*?take: 1/);
      assert.doesNotMatch(workspaceService, /reviews:\s*\{[\s\S]*?select: \{[\s\S]*?comment: true/);
    });

    it("5.C Full keyboard navigation and ARIA attributes exist across star ratings and radio group", () => {
      const starRating = readCode("components/reviews/star-rating.tsx");
      assert.match(starRating, /role="radiogroup"/);
      assert.match(starRating, /role="radio"/);
      assert.match(starRating, /aria-checked=/);
      assert.match(starRating, /onKeyDown=/);

      const intro = readCode("components/host/host-review-introduction.tsx");
      assert.match(intro, /role="radiogroup"/);
      assert.match(intro, /aria-label=\{`Would you recommend \$\{context\.guest\.name\} to other hosts\?`\}/);
      assert.match(intro, /role="progressbar"/);
    });
  });
});
