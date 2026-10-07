import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  CLEANLINESS_FEEDBACK_TAGS,
  COMMUNICATION_FEEDBACK_TAGS,
  HOST_PRIVATE_NOTE_MAX_LENGTH,
  HOST_PUBLIC_REVIEW_MAX_LENGTH,
  isCleanlinessFeedbackTag,
  isCommunicationFeedbackTag,
  isHostPrivateNoteText,
  isHostPublicReviewText,
  isHostRecommendation,
  isHostReviewRating,
  validateHostReviewDraft,
  validateHostReviewSubmission,
} from "../lib/booking/host-review-draft";

const root = path.resolve(import.meta.dirname, "..");
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Host Review Phase 17 — Validation & Error Handling", () => {
  it("1. required ratings and recommendation cannot be omitted or null", () => {
    // Missing cleanliness
    assert.equal(
      validateHostReviewSubmission({
        bookingId: "bkg-1",
        cleanlinessRating: 0,
        houseRulesRating: 5,
        communicationRating: 5,
        recommendGuest: true,
      }).valid,
      false,
    );

    // Missing house rules
    assert.equal(
      validateHostReviewSubmission({
        bookingId: "bkg-1",
        cleanlinessRating: 5,
        houseRulesRating: 0,
        communicationRating: 5,
        recommendGuest: true,
      }).valid,
      false,
    );

    // Missing communication
    assert.equal(
      validateHostReviewSubmission({
        bookingId: "bkg-1",
        cleanlinessRating: 5,
        houseRulesRating: 5,
        communicationRating: 0,
        recommendGuest: true,
      }).valid,
      false,
    );

    // Missing recommendation
    assert.equal(
      validateHostReviewSubmission({
        bookingId: "bkg-1",
        cleanlinessRating: 5,
        houseRulesRating: 5,
        communicationRating: 5,
        recommendGuest: null,
      }).valid,
      false,
    );
  });

  it("2. optional fields (tags, public review, private note) can be completely empty", () => {
    const emptyOptional = validateHostReviewSubmission({
      bookingId: "bkg-1",
      cleanlinessRating: 4,
      cleanlinessTags: [],
      houseRulesRating: 4,
      communicationRating: 4,
      communicationTags: [],
      publicReview: "",
      recommendGuest: true,
      privateNote: "",
    });

    assert.equal(emptyOptional.valid, true);
    assert.deepEqual(emptyOptional.data?.cleanlinessTags, []);
    assert.deepEqual(emptyOptional.data?.communicationTags, []);
    assert.equal(emptyOptional.data?.publicReview, "");
    assert.equal(emptyOptional.data?.privateNote, "");
  });

  it("3. recommendation 'No' (false) is valid and not rejected by falsy boolean checks", () => {
    assert.equal(isHostRecommendation(false), true);
    assert.equal(isHostRecommendation(true), true);
    assert.equal(isHostRecommendation(null), false);
    assert.equal(isHostRecommendation(undefined), false);

    const submissionWithNo = validateHostReviewSubmission({
      bookingId: "bkg-1",
      cleanlinessRating: 3,
      houseRulesRating: 2,
      communicationRating: 3,
      recommendGuest: false,
    });
    assert.equal(submissionWithNo.valid, true);
    assert.equal(submissionWithNo.data?.recommendGuest, false);
  });

  it("4. step navigation prevents skipping incomplete required ratings and recommendation", () => {
    const wizard = source("components/host/host-review-introduction.tsx");

    assert.match(wizard, /step === 1 && cleanlinessValid/);
    assert.match(wizard, /step === 2 && houseRulesValid/);
    assert.match(wizard, /step === 3 && communicationValid/);
    assert.match(wizard, /step === 5 && recommendationValid/);
    assert.match(wizard, /disabled=\{!canContinue\}/);
    assert.match(wizard, /disabled=\{!canSubmit \|\| isSubmitting\}/);
  });

  it("5. inline validation helpers guide users when required fields are unselected", () => {
    const wizard = source("components/host/host-review-introduction.tsx");

    assert.match(wizard, /\{!cleanlinessValid && \([\s\S]*Please select a rating\./);
    assert.match(wizard, /\{!houseRulesValid && \([\s\S]*Please select a rating\./);
    assert.match(wizard, /\{!communicationValid && \([\s\S]*Please select a rating\./);
    assert.match(wizard, /\{!recommendationValid && \([\s\S]*Please choose Yes or No\./);
  });

  it("6. backend validation in submitHostReview checks authorization and review eligibility", () => {
    const service = source("services/host-review.service.ts");

    assert.match(service, /listingService\.listForHost\(actor/);
    assert.match(service, /getHostReviewEligibility\(\{/);
    assert.match(service, /if \(!eligibility\.eligible\) \{/);
  });

  it("7. network failure preserves entered draft and renders retry CTA without resetting step", () => {
    const wizard = source("components/host/host-review-introduction.tsx");

    assert.match(wizard, /setSubmitError\("Network error\. Please check your connection and try again\."\)/);
    assert.match(wizard, /Try again/);
    assert.match(wizard, /onClick=\{handleSubmit\}/);
    // draft state is not cleared on error
    assert.doesNotMatch(wizard, /catch[\s\S]*?setDraft\(initialDraft/);
  });

  it("8. unknown submission outcome: 409 Conflict on retry is recognized as success and cleans up draft", () => {
    const wizard = source("components/host/host-review-introduction.tsx");

    assert.match(wizard, /if \(response\.status === 409\) \{/);
    assert.match(wizard, /window\.sessionStorage\.removeItem\(draftKey\);/);
    assert.match(wizard, /setIsSubmitted\(true\);/);
  });

  it("9. prevents double submit and rapid multi-clicks with guard and loading spinner", () => {
    const wizard = source("components/host/host-review-introduction.tsx");

    assert.match(wizard, /if \(isSubmitting \|\| !canSubmit\) return;/);
    assert.match(wizard, /setIsSubmitting\(true\);/);
    assert.match(wizard, /isSubmitting \? \([\s\S]*animate-spin[\s\S]*Submitting\.\.\.[\s\S]*\) : \(\s*"Submit"\s*\)/);
  });
});

describe("Host Review Phase 18 — Draft Persistence, Mobile UX & Accessibility", () => {
  it("1. draft persistence keys are strictly scoped by hostId and bookingId", () => {
    const wizard = source("components/host/host-review-introduction.tsx");

    assert.match(wizard, /const draftKey = `homyz:host-review-draft:\$\{context\.hostId\}:\$\{context\.bookingId\}`;/);
    assert.match(wizard, /if \(saved\.bookingId !== context\.bookingId \|\| saved\.hostId !== context\.hostId\) return fallback;/);
  });

  it("2. restores all draft fields (ratings, tags, text, recommendation, private note) from storage", () => {
    const wizard = source("components/host/host-review-introduction.tsx");

    assert.match(wizard, /cleanlinessRating/);
    assert.match(wizard, /cleanlinessTags/);
    assert.match(wizard, /houseRulesRating/);
    assert.match(wizard, /communicationRating/);
    assert.match(wizard, /communicationTags/);
    assert.match(wizard, /publicReview/);
    assert.match(wizard, /recommendGuest/);
    assert.match(wizard, /privateNote/);
  });

  it("3. flushes draft to sessionStorage immediately before page unload or refresh", () => {
    const wizard = source("components/host/host-review-introduction.tsx");

    assert.match(wizard, /window\.addEventListener\("beforeunload", flushDraft\);/);
    assert.match(wizard, /window\.removeEventListener\("beforeunload", flushDraft\);/);
  });

  it("4. restores step safely without allowing user to skip incomplete required steps", () => {
    const wizard = source("components/host/host-review-introduction.tsx");

    assert.match(wizard, /requestedStep >= 7 && hasRatings && hasRecommendation/);
    assert.match(wizard, /requestedStep >= 6 && hasRatings && hasRecommendation/);
    assert.match(wizard, /requestedStep >= 5 && cleanlinessRating && houseRulesRating && communicationRating/);
    assert.match(wizard, /requestedStep >= 4 && cleanlinessRating && houseRulesRating && communicationRating/);
    assert.match(wizard, /requestedStep >= 3 && cleanlinessRating && houseRulesRating/);
    assert.match(wizard, /requestedStep >= 2 && cleanlinessRating/);
  });

  it("5. back button decrements step and preserves entered state", () => {
    const wizard = source("components/host/host-review-introduction.tsx");

    assert.match(wizard, /if \(step > 0\) \{/);
    assert.match(wizard, /setDraft\(\(current\) => \(\{ \.\.\.current, step: \(step - 1\) as ReviewStep \}\)\);/);
  });

  it("6. cleans up sessionStorage draft only on successful submission", () => {
    const wizard = source("components/host/host-review-introduction.tsx");

    assert.match(wizard, /window\.sessionStorage\.removeItem\(draftKey\);/);
  });

  it("7. responsive layout uses single-column on mobile and dual-column on large screens", () => {
    const wizard = source("components/host/host-review-introduction.tsx");

    assert.match(wizard, /grid w-full max-w-6xl gap-8 lg:grid-cols-\[300px_minmax\(0,1fr\)\] lg:gap-14/);
  });

  it("8. primary CTA navigation is sticky on mobile with safe-area spacing", () => {
    const wizard = source("components/host/host-review-introduction.tsx");

    assert.match(wizard, /sticky bottom-0 z-20/);
    assert.match(wizard, /env\(safe-area-inset-bottom\)/);
    assert.match(wizard, /sm:static/);
    assert.match(wizard, /pb-20 sm:pb-8/);
  });

  it("9. StarRating provides keyboard navigation (arrow keys, 1-5 keys, roving tabindex)", () => {
    const stars = source("components/reviews/star-rating.tsx");

    assert.match(stars, /event\.key === "ArrowRight" \|\| event\.key === "ArrowUp"/);
    assert.match(stars, /event\.key === "ArrowLeft" \|\| event\.key === "ArrowDown"/);
    assert.match(stars, /\["1", "2", "3", "4", "5"\]\.includes\(event\.key\)/);
    assert.match(stars, /tabIndex=\{isSelected \|\| \(value === 0 && star === 1\) \? 0 : -1\}/);
    assert.match(stars, /role="radio"/);
    assert.match(stars, /aria-checked=\{isSelected\}/);
    assert.match(stars, /focus-visible:outline-2/);
  });

  it("10. recommendation radio group provides keyboard navigation (ArrowLeft/ArrowRight)", () => {
    const wizard = source("components/host/host-review-introduction.tsx");

    assert.match(wizard, /e\.key === "ArrowRight" \|\| e\.key === "ArrowDown"/);
    assert.match(wizard, /e\.key === "ArrowLeft" \|\| e\.key === "ArrowUp"/);
    assert.match(wizard, /role="radiogroup"/);
    assert.match(wizard, /role="radio"/);
  });

  it("11. accessible progress bar and polite aria-live feedback announcements", () => {
    const wizard = source("components/host/host-review-introduction.tsx");

    assert.match(wizard, /role="progressbar"/);
    assert.match(wizard, /aria-valuenow=\{step \+ 1\}/);
    assert.match(wizard, /aria-valuemin=\{1\}/);
    assert.match(wizard, /aria-valuemax=\{REVIEW_STEPS\.length\}/);
    assert.match(wizard, /aria-live="polite"/);
  });

  it("12. neutral, respectful, and constructive copy throughout review flow", () => {
    const wizard = source("components/host/host-review-introduction.tsx");

    assert.match(wizard, /Honest feedback helps other hosts assess guest reliability/);
    assert.match(wizard, /Say a few words about your experience hosting this guest/);
    assert.match(wizard, /Your recommendation helps other hosts evaluate this guest/);
    assert.match(wizard, /Share private feedback with \$\{context\.guest\.name\}/);
  });
});
