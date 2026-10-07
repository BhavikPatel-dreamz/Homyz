import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  HOST_PRIVATE_NOTE_MAX_LENGTH,
  isHostPrivateNoteText,
  isHostRecommendation,
  validateHostReviewDraft,
} from "../lib/booking/host-review-draft";

const root = path.resolve(import.meta.dirname, "..");
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Host review Phase 11 — Guest Recommendation (Yes/No)", () => {
  it("validates recommendation as a strict boolean (true/false) and rejects null, undefined, strings, or numbers", () => {
    assert.equal(isHostRecommendation(true), true);
    assert.equal(isHostRecommendation(false), true);
    assert.equal(isHostRecommendation(null), false);
    assert.equal(isHostRecommendation(undefined), false);
    assert.equal(isHostRecommendation("yes"), false);
    assert.equal(isHostRecommendation(1), false);
    assert.equal(isHostRecommendation(0), false);
  });

  it("validates draft with recommendation using validateHostReviewDraft", () => {
    const validYes = validateHostReviewDraft({
      cleanlinessRating: 5,
      cleanlinessTags: [],
      houseRulesRating: 4,
      communicationRating: 5,
      communicationTags: [],
      publicReview: "Great guest",
      recommendGuest: true,
    });
    assert.equal(validYes.recommendGuest, true);

    const validNo = validateHostReviewDraft({
      cleanlinessRating: 2,
      cleanlinessTags: [],
      houseRulesRating: 2,
      communicationRating: 3,
      communicationTags: [],
      publicReview: "Needs improvement",
      recommendGuest: false,
    });
    assert.equal(validNo.recommendGuest, true);

    const invalid = validateHostReviewDraft({
      cleanlinessRating: 5,
      cleanlinessTags: [],
      houseRulesRating: 5,
      communicationRating: 5,
      communicationTags: [],
      publicReview: "",
      recommendGuest: null,
    });
    assert.equal(invalid.recommendGuest, false);
  });

  it("renders Recommendation UI at step 5 with question and single-selection Yes/No buttons", () => {
    const intro = source("components/host/host-review-introduction.tsx");

    assert.match(intro, /Would you recommend \{context\.guest\.name\} to other hosts\?/);
    assert.match(intro, /role="radiogroup"/);
    assert.match(intro, /aria-label=\{`Would you recommend \$\{context\.guest\.name\} to other hosts\?`\}/);
    assert.match(intro, /aria-checked=\{draft\.recommendGuest === true\}/);
    assert.match(intro, /aria-checked=\{draft\.recommendGuest === false\}/);
    assert.match(intro, /recommendGuest:\s*true/);
    assert.match(intro, /recommendGuest:\s*false/);
    assert.match(intro, /step === 5/);
  });

  it("enforces mandatory recommendation before proceeding to Private Note", () => {
    const intro = source("components/host/host-review-introduction.tsx");

    assert.match(intro, /recommendationValid = isHostRecommendation\(draft\.recommendGuest\)/);
    assert.match(intro, /step === 5 && recommendationValid/);
    assert.match(intro, /step: 6/);
    assert.match(intro, /requestedStep >= 6 && hasRatings && hasRecommendation/);
  });
});

describe("Host review Phase 12 — Private Note to Guest", () => {
  it("validates private note text up to 500 characters and accepts empty text", () => {
    assert.equal(isHostPrivateNoteText(""), true);
    assert.equal(isHostPrivateNoteText("Thanks for leaving the place tidy!"), true);
    assert.equal(isHostPrivateNoteText("x".repeat(HOST_PRIVATE_NOTE_MAX_LENGTH)), true);
    assert.equal(isHostPrivateNoteText("x".repeat(HOST_PRIVATE_NOTE_MAX_LENGTH + 1)), false);
    assert.equal(isHostPrivateNoteText(null), false);
    assert.equal(isHostPrivateNoteText(undefined), false);
  });

  it("validates draft with private note using validateHostReviewDraft", () => {
    const valid = validateHostReviewDraft({
      cleanlinessRating: 5,
      cleanlinessTags: [],
      houseRulesRating: 5,
      communicationRating: 5,
      communicationTags: [],
      publicReview: "Friendly guest",
      recommendGuest: true,
      privateNote: "Thank you for visiting!",
    });
    assert.equal(valid.privateNote, true);
    assert.equal(valid.recommendGuest, true);

    const tooLong = validateHostReviewDraft({
      cleanlinessRating: 5,
      cleanlinessTags: [],
      houseRulesRating: 5,
      communicationRating: 5,
      communicationTags: [],
      publicReview: "Friendly guest",
      recommendGuest: true,
      privateNote: "a".repeat(501),
    });
    assert.equal(tooLong.privateNote, false);
  });

  it("renders Private Note UI at step 6 with title, description, textarea, and character counter", () => {
    const intro = source("components/host/host-review-introduction.tsx");

    assert.match(intro, /Write a private note/);
    assert.match(intro, /Is there anything else you&apos;d like to share with \{context\.guest\.name\}\?/);
    assert.match(intro, /id="host-private-note"/);
    assert.match(intro, /maxLength=\{HOST_PRIVATE_NOTE_MAX_LENGTH\}/);
    assert.match(intro, /\{draft\.privateNote\.length\} \/ \{HOST_PRIVATE_NOTE_MAX_LENGTH\}/);
    assert.match(intro, /step === 6/);
  });

  it("allows proceeding from Private Note with empty or valid text to step 7 without auto-submitting", () => {
    const intro = source("components/host/host-review-introduction.tsx");

    assert.match(intro, /privateNoteValid = isHostPrivateNoteText\(draft\.privateNote\)/);
    assert.match(intro, /step === 6 && privateNoteValid/);
    assert.match(intro, /step: 7/);
    assert.match(intro, /step === 7/);
    assert.match(intro, /Submit review/);
    assert.match(intro, /Please review your feedback before submitting\./);
  });

  it("ensures public review APIs never expose host-to-guest reviews or private notes", () => {
    const publicRoute = source("app/api/v1/listings/[id]/reviews/route.ts");
    const mappers = source("services/mappers.ts");

    assert.doesNotMatch(publicRoute, /HostGuestReview/);
    assert.doesNotMatch(publicRoute, /privateNoteToGuest/);
    assert.doesNotMatch(mappers, /toPublicReviewDTO[\s\S]*privateNote/);
  });
});
