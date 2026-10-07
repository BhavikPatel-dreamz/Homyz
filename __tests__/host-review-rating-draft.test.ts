import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  CLEANLINESS_FEEDBACK_TAGS,
  isCleanlinessFeedbackTag,
  isHostReviewRating,
  validateHostReviewDraft,
} from "../lib/booking/host-review-draft";

const root = path.resolve(import.meta.dirname, "..");
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Host review Cleanliness and House Rules draft", () => {
  it("accepts only 1–5 star ratings and supported optional cleanliness tags", () => {
    assert.equal(isHostReviewRating(1), true);
    assert.equal(isHostReviewRating(5), true);
    assert.equal(isHostReviewRating(0), false);
    assert.equal(isHostReviewRating(6), false);
    assert.equal(isHostReviewRating(3.5), false);
    assert.equal(isCleanlinessFeedbackTag(CLEANLINESS_FEEDBACK_TAGS[0]), true);
    assert.equal(isCleanlinessFeedbackTag("Unsupported"), false);
  });

  it("keeps validation ready for the later server-side submission mutation", () => {
    assert.deepEqual(
      validateHostReviewDraft({
        cleanlinessRating: 5,
        cleanlinessTags: ["Neat & tidy", "Something else"],
        houseRulesRating: 4,
        communicationRating: 5,
        communicationTags: ["Helpful messages"],
        publicReview: "Great guest.",
      }),
      {
        cleanlinessRating: true,
        cleanlinessTags: true,
        houseRulesRating: true,
        communicationRating: true,
        communicationTags: true,
        publicReview: true,
      },
    );
    assert.deepEqual(
      validateHostReviewDraft({
        cleanlinessRating: 9,
        cleanlinessTags: ["Unknown" as never],
        houseRulesRating: 0,
        communicationRating: -1,
        communicationTags: ["Unknown" as never],
        publicReview: "x".repeat(501),
      }),
      {
        cleanlinessRating: false,
        cleanlinessTags: false,
        houseRulesRating: false,
        communicationRating: false,
        communicationTags: false,
        publicReview: false,
      },
    );
  });

  it("uses one shared accessible star component and the documented optional tags", () => {
    const intro = source("components/host/host-review-introduction.tsx");
    const stars = source("components/reviews/star-rating.tsx");
    const guestWizard = source("components/reviews/booking-review-wizard.tsx");

    assert.match(intro, /How clean did \{context\.guest\.name\} leave your place/);
    assert.match(intro, /How well did \{context\.guest\.name\} follow your house rules/);
    assert.match(intro, /CLEANLINESS_FEEDBACK_TAGS/);
    assert.match(intro, /aria-pressed=\{selected\}/);
    assert.match(intro, /disabled=\{!canContinue\}/);
    assert.match(stars, /role="radiogroup"/);
    assert.match(stars, /aria-checked/);
    assert.match(guestWizard, /import \{ StarRating \} from "\.\/star-rating"/);
  });

  it("scopes persisted drafts to both the authenticated host and booking", () => {
    const intro = source("components/host/host-review-introduction.tsx");

    assert.match(intro, /host-review-draft:\$\{context\.hostId\}:\$\{context\.bookingId\}/);
    assert.match(intro, /saved\.bookingId !== context\.bookingId \|\| saved\.hostId !== context\.hostId/);
    assert.match(intro, /requestedStep >= 2 && cleanlinessRating/);
  });
});
