import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  REQUEST_BOOK_STEPS,
  canActivateCheckoutStep,
  checkoutDraftStorageKey,
  getCheckoutStepStatus,
  getCheckoutSteps,
  parseSafeCheckoutDraft,
} from "../lib/booking/checkout-wizard";

assert.deepEqual(
  REQUEST_BOOK_STEPS.map(({ number, title }) => ({ number, title })),
  [
    { number: 1, title: "Choose when to pay" },
    { number: 2, title: "Payment method" },
    { number: 3, title: "Write a message to the host" },
    { number: 4, title: "Review your request" },
  ],
  "Request to Book uses the required four-step order",
);
assert.equal(getCheckoutSteps("REQUEST_TO_BOOK").length, 4);
assert.equal(getCheckoutSteps("INSTANT_BOOK").length, 4);

const completed = new Set([1, 2]);
assert.equal(getCheckoutStepStatus(1, 3, completed), "COMPLETED");
assert.equal(getCheckoutStepStatus(3, 3, completed), "ACTIVE");
assert.equal(getCheckoutStepStatus(4, 3, completed), "LOCKED");
assert.equal(canActivateCheckoutStep(3, "REQUEST_TO_BOOK", completed), true);
assert.equal(canActivateCheckoutStep(4, "REQUEST_TO_BOOK", completed), false);
assert.equal(canActivateCheckoutStep(3, "INSTANT_BOOK", completed), true);

const safeDraft = {
  version: 1 as const,
  intentSignature: "listing-1|dates|guests",
  bookingMode: "REQUEST_TO_BOOK" as const,
  activeStep: 3 as const,
  completedSteps: [1, 2] as const,
  paymentTiming: "FULL_NOW" as const,
  paymentMethod: null,
  hostMessage: "Looking forward to the trip.",
  requestSubmissionId: "d775ae0f-051b-48d0-b2ae-12a68f62cde9",
};
assert.deepEqual(
  parseSafeCheckoutDraft(safeDraft, safeDraft.intentSignature, safeDraft.bookingMode),
  { ...safeDraft, completedSteps: [1, 2] },
  "a matching unpaid Request-to-Book draft restores its safe progress",
);
assert.equal(
  parseSafeCheckoutDraft(safeDraft, "different-intent", safeDraft.bookingMode),
  null,
  "a draft cannot leak across booking intents",
);
assert.equal(
  parseSafeCheckoutDraft({ ...safeDraft, completedSteps: [2] }, safeDraft.intentSignature, safeDraft.bookingMode),
  null,
  "a malformed draft cannot skip prerequisites",
);
assert.equal(checkoutDraftStorageKey("abc"), "homyz_checkout_draft_v1:abc");

const root = path.resolve(import.meta.dirname, "..");
const checkout = fs.readFileSync(path.join(root, "app/book/[id]/booking-checkout-client.tsx"), "utf8");
assert.match(checkout, /data-step-status=\{stepStatus\(1\)\}/, "wizard exposes explicit step status");
assert.match(checkout, /aria-current=\{activeStep === 1 \? "step"/, "active step is announced");
assert.match(checkout, /sessionStorage\.setItem\(draftStorageKey/, "safe progress persists for refresh/back navigation");
assert.match(checkout, /Card\s*\n\s*\/\/ fields deliberately remain separate and are never written to storage/, "sensitive card state is excluded from the draft");
assert.match(checkout, /className="order-1 space-y-12"/, "wizard precedes summary on mobile");
assert.match(checkout, /className="order-2 lg:sticky lg:top-24"/, "summary follows wizard on mobile and remains sticky on desktop");
assert.doesNotMatch(checkout, /!isInstantBook && <>/, "both booking modes expose all four steps");
assert.match(checkout, /aria-busy="true"/, "draft hydration has an explicit loading state");

console.log("Phase 2 checkout wizard regression checks passed.");
