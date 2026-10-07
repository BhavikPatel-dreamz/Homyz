import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  COMMUNICATION_FEEDBACK_TAGS,
  HOST_PUBLIC_REVIEW_MAX_LENGTH,
  isCommunicationFeedbackTag,
  isHostPublicReviewText,
  isHostReviewRating,
} from "../lib/booking/host-review-draft";

const root = path.resolve(import.meta.dirname, "..");
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Host review Communication and Public Review draft", () => {
  it("accepts only valid communication ratings, tags, and optional text within 500 characters", () => {
    assert.equal(isHostReviewRating(5), true);
    assert.equal(isHostReviewRating(0), false);
    assert.equal(isCommunicationFeedbackTag("Helpful messages"), true);
    assert.equal(isCommunicationFeedbackTag("Always responded"), true);
    assert.equal(isCommunicationFeedbackTag("Unknown"), false);
    assert.equal(isHostPublicReviewText(""), true);
    assert.equal(isHostPublicReviewText("x".repeat(HOST_PUBLIC_REVIEW_MAX_LENGTH)), true);
    assert.equal(isHostPublicReviewText("x".repeat(HOST_PUBLIC_REVIEW_MAX_LENGTH + 1)), false);
  });

  it("renders Communication with optional multi-select tags and a required rating", () => {
    const intro = source("components/host/host-review-introduction.tsx");

    assert.match(intro, /How well did \{context\.guest\.name\} communicate/);
    assert.match(intro, /COMMUNICATION_FEEDBACK_TAGS/);
    assert.match(intro, /communicationRating/);
    assert.match(intro, /communicationTags/);
    assert.match(intro, /step === 3 && communicationValid/);
  });

  it("renders the optional host-only public review with its counter and maximum", () => {
    const intro = source("components/host/host-review-introduction.tsx");
    const publicListingRoute = source("app/api/v1/listings/[id]/reviews/route.ts");

    assert.match(intro, /Write a public review/);
    assert.match(intro, /Say a few words about your experience hosting this guest/);
    assert.match(intro, /maxLength=\{HOST_PUBLIC_REVIEW_MAX_LENGTH\}/);
    assert.match(intro, /\{draft\.publicReview\.length\} \/ \{HOST_PUBLIC_REVIEW_MAX_LENGTH\}/);
    assert.match(intro, /step === 4/);
    assert.doesNotMatch(publicListingRoute, /HostGuestReview/);
  });

  it("prevents persisted drafts from skipping required Communication", () => {
    const intro = source("components/host/host-review-introduction.tsx");

    assert.match(intro, /requestedStep >= 4 && cleanlinessRating && houseRulesRating && communicationRating/);
    assert.match(intro, /requestedStep >= 3 && cleanlinessRating && houseRulesRating/);
  });

  it("uses the documented Communication tags exactly", () => {
    assert.deepEqual(COMMUNICATION_FEEDBACK_TAGS, [
      "Helpful messages",
      "Always responded",
      "Respectful",
      "Something else",
    ]);
  });
});
