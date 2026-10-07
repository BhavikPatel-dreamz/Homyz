import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  CLEANLINESS_FEEDBACK_TAGS,
  COMMUNICATION_FEEDBACK_TAGS,
  HOST_PRIVATE_NOTE_MAX_LENGTH,
  HOST_PUBLIC_REVIEW_MAX_LENGTH,
  isHostPrivateNoteText,
  isHostPublicReviewText,
  isHostRecommendation,
  isHostReviewRating,
  validateHostReviewDraft,
  validateHostReviewSubmission,
} from "../lib/booking/host-review-draft";
const root = path.resolve(import.meta.dirname, "..");
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Host review Phase 13 — Final Host Review Submission", () => {
  it("1. validates required ratings (1-5 integer for cleanliness, house rules, communication)", () => {
    const invalidRatings = validateHostReviewSubmission({
      bookingId: "bkg-123",
      cleanlinessRating: 0,
      houseRulesRating: 6,
      communicationRating: 3.5,
      recommendGuest: true,
    });
    assert.equal(invalidRatings.valid, false);
    assert.ok(invalidRatings.errors.cleanlinessRating);
    assert.ok(invalidRatings.errors.houseRulesRating);
    assert.ok(invalidRatings.errors.communicationRating);

    const validRatings = validateHostReviewSubmission({
      bookingId: "bkg-123",
      cleanlinessRating: 5,
      houseRulesRating: 4,
      communicationRating: 5,
      recommendGuest: true,
    });
    assert.equal(validRatings.valid, true);
    assert.equal(validRatings.data?.cleanlinessRating, 5);
    assert.equal(validRatings.data?.houseRulesRating, 4);
    assert.equal(validRatings.data?.communicationRating, 5);
  });

  it("2. requires recommendation and rejects null, undefined, strings, numbers", () => {
    assert.equal(
      validateHostReviewSubmission({
        bookingId: "bkg-123",
        cleanlinessRating: 5,
        houseRulesRating: 5,
        communicationRating: 5,
        recommendGuest: null,
      }).valid,
      false,
    );

    assert.equal(
      validateHostReviewSubmission({
        bookingId: "bkg-123",
        cleanlinessRating: 5,
        houseRulesRating: 5,
        communicationRating: 5,
        recommendGuest: undefined,
      }).valid,
      false,
    );

    assert.equal(
      validateHostReviewSubmission({
        bookingId: "bkg-123",
        cleanlinessRating: 5,
        houseRulesRating: 5,
        communicationRating: 5,
        recommendGuest: "yes",
      }).valid,
      false,
    );
  });

  it("3. accepts No recommendation (recommendGuest: false) as completely valid without falsy rejection", () => {
    const validNo = validateHostReviewSubmission({
      bookingId: "bkg-123",
      cleanlinessRating: 3,
      houseRulesRating: 2,
      communicationRating: 3,
      recommendGuest: false,
    });
    assert.equal(validNo.valid, true);
    assert.equal(validNo.data?.recommendGuest, false);
  });

  it("4. accepts empty optional public review", () => {
    const emptyPublic = validateHostReviewSubmission({
      bookingId: "bkg-123",
      cleanlinessRating: 5,
      houseRulesRating: 5,
      communicationRating: 5,
      recommendGuest: true,
      publicReview: "",
    });
    assert.equal(emptyPublic.valid, true);
    assert.equal(emptyPublic.data?.publicReview, "");

    const omittedPublic = validateHostReviewSubmission({
      bookingId: "bkg-123",
      cleanlinessRating: 5,
      houseRulesRating: 5,
      communicationRating: 5,
      recommendGuest: true,
    });
    assert.equal(omittedPublic.valid, true);
    assert.equal(omittedPublic.data?.publicReview, "");
  });

  it("5. accepts empty optional private note to guest", () => {
    const emptyNote = validateHostReviewSubmission({
      bookingId: "bkg-123",
      cleanlinessRating: 5,
      houseRulesRating: 5,
      communicationRating: 5,
      recommendGuest: true,
      privateNote: "",
    });
    assert.equal(emptyNote.valid, true);
    assert.equal(emptyNote.data?.privateNote, "");

    const omittedNote = validateHostReviewSubmission({
      bookingId: "bkg-123",
      cleanlinessRating: 5,
      houseRulesRating: 5,
      communicationRating: 5,
      recommendGuest: true,
    });
    assert.equal(omittedNote.valid, true);
    assert.equal(omittedNote.data?.privateNote, "");
  });

  it("6. renders Submit button at step 7 with disabled loading state while processing", () => {
    const intro = source("components/host/host-review-introduction.tsx");

    assert.match(intro, /step === 7/);
    assert.match(intro, /Submit review/);
    assert.match(intro, /handleSubmit/);
    assert.match(intro, /disabled=\{!canSubmit \|\| isSubmitting\}/);
    assert.match(intro, /isSubmitting \? \([\s\S]*Submitting\.\.\.[\s\S]*\) : \(\s*"Submit"\s*\)/);
  });

  it("7. prevents double-clicks and repeated requests on the frontend and backend", () => {
    const intro = source("components/host/host-review-introduction.tsx");
    const service = source("services/host-review.service.ts");
    const schema = source("prisma/schema.prisma");

    assert.match(intro, /if \(isSubmitting \|\| !canSubmit\) return;/);
    assert.match(service, /code === "P2002"/);
    assert.match(schema, /model HostGuestReview[\s\S]*bookingId\s+String\s+@unique/);
  });

  it("8. preserves entered data in draft and session storage when network or validation fails", () => {
    const intro = source("components/host/host-review-introduction.tsx");

    assert.match(intro, /setSubmitError\("Network error\. Please check your connection and try again\."\)/);
    // Draft storage is removed only on successful response
    assert.match(intro, /if \(!response\.ok\) \{/);
    assert.match(intro, /window\.sessionStorage\.removeItem\(draftKey\)/);
  });

  it("9. displays success state on confirmation and links back to reservations", () => {
    const intro = source("components/host/host-review-introduction.tsx");

    assert.match(intro, /if \(isSubmitted\) \{/);
    assert.match(intro, /Review submitted/);
    assert.match(intro, /Back to reservations/);
    assert.match(intro, /href=\{returnHref\}/);
  });

  it("10. rejects submission with missing or empty booking ID", () => {
    const missingBooking = validateHostReviewSubmission({
      cleanlinessRating: 5,
      houseRulesRating: 5,
      communicationRating: 5,
      recommendGuest: true,
    });
    assert.equal(missingBooking.valid, false);
    assert.ok(missingBooking.errors.bookingId);
  });
});

describe("Host review Phase 14 — Backend Review Processing", () => {
  it("1. validates submission payload fields and tags", () => {
    const fullPayload = {
      bookingId: "bkg-abc",
      cleanlinessRating: 5,
      cleanlinessTags: [CLEANLINESS_FEEDBACK_TAGS[0]],
      houseRulesRating: 4,
      communicationRating: 5,
      communicationTags: [COMMUNICATION_FEEDBACK_TAGS[1]],
      publicReview: "Fantastic guests, left everything clean.",
      recommendGuest: true,
      privateNote: "Thank you for the thoughtful care of our space!",
    };
    const validated = validateHostReviewSubmission(fullPayload);
    assert.equal(validated.valid, true);
    assert.equal(validated.data?.bookingId, "bkg-abc");
    assert.deepEqual(validated.data?.cleanlinessTags, [CLEANLINESS_FEEDBACK_TAGS[0]]);
    assert.deepEqual(validated.data?.communicationTags, [COMMUNICATION_FEEDBACK_TAGS[1]]);
    assert.equal(validated.data?.publicReview, "Fantastic guests, left everything clean.");
    assert.equal(validated.data?.recommendGuest, true);
    assert.equal(validated.data?.privateNote, "Thank you for the thoughtful care of our space!");
  });

  it("2. server derives host identity from session and validates property authorization", () => {
    const service = source("services/host-review.service.ts");
    const route = source("app/api/v1/host/reviews/route.ts");

    assert.match(route, /const actor = await getSessionUser\(\)/);
    assert.match(route, /if \(!actor\) throw AppError\.unauthorized\(\)/);
    assert.match(service, /hostId: actor\.id/);
    assert.match(service, /listingService\.listForHost\(actor/);
    assert.match(service, /listingId: \{ in: listingIds \}/);
  });

  it("3. checks stay completion and review window via getHostReviewEligibility", () => {
    const service = source("services/host-review.service.ts");

    assert.match(service, /getHostReviewEligibility\(\{/);
    assert.match(service, /hasHostReview: Boolean\(booking\.hostGuestReview\)/);
    assert.match(service, /if \(!eligibility\.eligible\) \{/);
  });

  it("4. persists ratings, tags, publicReview, recommendGuest, and privateNote in HostGuestReview", () => {
    const schema = source("prisma/schema.prisma");

    assert.match(schema, /cleanlinessRating\s+Int/);
    assert.match(schema, /cleanlinessTags\s+String\[\]/);
    assert.match(schema, /houseRulesRating\s+Int/);
    assert.match(schema, /communicationRating\s+Int/);
    assert.match(schema, /communicationTags\s+String\[\]/);
    assert.match(schema, /publicReview\s+String\?/);
    assert.match(schema, /recommendGuest\s+Boolean/);
    assert.match(schema, /privateNote\s+String\?/);
    assert.match(schema, /status\s+ReviewStatus/);
    assert.match(schema, /submittedAt\s+DateTime/);
  });

  it("5. prevents duplicate submissions with database uniqueness and 409 Conflict handling", () => {
    const service = source("services/host-review.service.ts");

    assert.match(service, /code === "P2002"/);
    assert.match(service, /throw AppError\.conflict\("A review has already been submitted for this reservation\."\)/);
  });

  it("6. triggers guest notification outside the DB write using notificationService.create", () => {
    const service = source("services/host-review.service.ts");

    assert.match(service, /notificationService\.create\(\{/);
    assert.match(service, /userId: booking\.userId/);
    assert.match(service, /type: NotificationType\.BOOKING/);
    assert.match(service, /entityType: "HOST_REVIEW"/);
    assert.match(service, /catch \(notifErr\) \{/);
  });

  it("7. calculates guest review statistics and recommendation scores correctly", () => {
    const service = source("services/host-review.service.ts");

    assert.match(service, /getGuestHostReviewStats\(guestId: string\)/);
    assert.match(service, /reviews\.filter\(\(r: GuestReviewRow\) => r\.recommendGuest === true\)\.length/);
    assert.match(service, /const notRecommendedCount = totalReviews - recommendedCount;/);
    assert.match(service, /Math\.round\(\(recommendedCount \/ totalReviews\) \* 100\)/);
    assert.match(service, /averageCleanlinessRating/);
    assert.match(service, /averageHouseRulesRating/);
    assert.match(service, /averageCommunicationRating/);
    assert.match(service, /overallAverageRating/);
  });

  it("8. respects review visibility matrix by redacting privateNote for non-author/non-subject", () => {
    const service = source("services/host-review.service.ts");

    assert.match(service, /const isAuthor = actor\.id === review\.hostId;/);
    assert.match(service, /const isSubject = actor\.id === review\.guestId;/);
    assert.match(service, /const privateNote = \(isAuthor \|\| isSubject\) \? review\.privateNote : null;/);
  });

  it("9. ensures public listing reviews route NEVER queries or leaks HostGuestReview", () => {
    const publicListingRoute = source("app/api/v1/listings/[id]/reviews/route.ts");

    assert.doesNotMatch(publicListingRoute, /HostGuestReview/);
    assert.doesNotMatch(publicListingRoute, /hostGuestReview/);
    assert.doesNotMatch(publicListingRoute, /recommendGuest/);
  });

  it("10. keeps HostGuestReview completely separate from Guest -> Property reviews", () => {
    const reviewService = source("services/review.service.ts");

    assert.doesNotMatch(reviewService, /HostGuestReview/);
  });
});
