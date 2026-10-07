import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Host review eligibility and introduction entry", () => {
  it("uses the centralized eligibility function behind a host-scoped booking query", () => {
    const service = source("services/host-review.service.ts");

    assert.match(service, /listingService\.listForHost\(actor/);
    assert.match(service, /listingId: \{ in: listingIds \}/);
    assert.match(service, /hostGuestReview: \{ select: \{ submittedAt: true \} \}/);
    assert.match(service, /getHostReviewEligibility\(/);
    assert.match(service, /now: new Date\(\)/);
  });

  it("keeps direct review URLs protected and does not start an ineligible review", () => {
    const page = source("app/(protected)/host/reviews/[bookingId]/page.tsx");

    assert.match(page, /requirePageRole\(\[Role\.HOST, Role\.ADMIN\]\)/);
    assert.match(page, /getHostReviewContext\(actor, bookingId\)/);
    assert.match(page, /if \(!context\) notFound\(\)/);
    assert.match(page, /context\.eligibility\.eligible/);
  });

  it("connects the existing details modal to the selected host-review booking", () => {
    const workspace = source("components/host/host-today-workspace.tsx");
    const modal = source("components/host/host-workspace-shared.tsx");

    assert.match(workspace, /onHostReview=\{\(\) => router\.push\(`\/host\/reviews\/\$\{encodeURIComponent\(selected\.id\)\}`\)\}/);
    assert.match(modal, /Write a review/);
    assert.match(modal, /status === "REVIEW_PENDING"/);
  });

  it("preserves a booking-specific draft and advances only to the prepared Cleanliness step", () => {
    const intro = source("components/host/host-review-introduction.tsx");

    assert.match(intro, /homyz:host-review-draft:\$\{context\.hostId\}:\$\{context\.bookingId\}/);
    assert.match(intro, /Step \{step \+ 1\} of \{REVIEW_STEPS\.length\}/);
    assert.match(intro, /step: 1/);
    assert.match(intro, /Cleanliness/);
    assert.match(intro, /router\.push\(returnHref\)/);
  });

  it("retains database-level duplicate protection for later submission phases", () => {
    const schema = source("prisma/schema.prisma");

    assert.match(schema, /model HostGuestReview[\s\S]*bookingId\s+String\s+@unique/);
  });
});
