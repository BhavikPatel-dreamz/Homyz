import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

test("the review route owns a wizard-shaped loading boundary", () => {
  const reviewLoading = read("app/(protected)/bookings/[id]/review/loading.tsx");
  const reviewWizard = read("components/reviews/booking-review-wizard.tsx");

  assert.match(reviewLoading, /aria-label="Loading review form"/);
  assert.match(reviewLoading, /max-w-6xl/);
  assert.match(reviewLoading, /lg:grid-cols-\[300px_minmax\(0,1fr\)\]/);
  assert.match(reviewLoading, /aspect-\[4\/3\]/);
  assert.match(reviewLoading, /min-h-\[560px\]/);
  assert.match(reviewLoading, /sm:px-8 sm:py-8/);
  assert.match(reviewLoading, /h-1 overflow-hidden rounded-full/);
  assert.match(reviewLoading, /h-11 w-20/);
  assert.match(reviewLoading, /h-11 w-28/);

  // Keep critical geometry in lockstep with the rendered review wizard.
  assert.match(reviewWizard, /max-w-6xl gap-8 lg:grid-cols-\[300px_minmax\(0,1fr\)\] lg:gap-14/);
  assert.match(reviewWizard, /aspect-\[4\/3\]/);
  assert.match(reviewWizard, /min-h-\[560px\]/);
});

test("reservation details keeps its distinct loading boundary", () => {
  const detailsLoading = read("app/(protected)/bookings/[id]/loading.tsx");

  assert.match(detailsLoading, /Loading reservation details/);
  assert.match(detailsLoading, /lg:grid-cols-\[minmax\(0,1fr\)_380px\]/);
});
