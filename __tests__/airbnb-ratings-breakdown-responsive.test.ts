import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");
}

describe("Airbnb Ratings Breakdown Responsive Design Audit", () => {
  const breakdownCode = readFile("components/reviews/review-breakdown.tsx");
  const reviewListCode = readFile("components/reviews/review-list.tsx");

  describe("1. Desktop Layout (1024px+)", () => {
    it("preserves 7-column horizontal layout with dividers and consistent spacing", () => {
      assert.match(breakdownCode, /hidden lg:grid lg:grid-cols-7 lg:items-stretch lg:divide-x lg:divide-zinc-200\/80/);
      assert.match(breakdownCode, /flex min-w-\[150px\] flex-col justify-between pr-6/);
      assert.match(breakdownCode, /flex min-w-\[100px\] flex-col justify-between px-6/);
    });

    it("keeps histogram and all 6 categories properly aligned with score and icon", () => {
      assert.match(breakdownCode, /reviews_overall_rating/);
      assert.match(breakdownCode, /\[5,\s*4,\s*3,\s*2,\s*1\]/);
      assert.match(breakdownCode, /ReviewIcon name=\{icon\} className="size-7"/);
    });
  });

  describe("2. Tablet Layout (768px–1023px)", () => {
    it("displays overall rating histogram separately without horizontal scrolling", () => {
      assert.match(breakdownCode, /hidden md:block lg:hidden/);
      assert.match(breakdownCode, /max-w-sm rounded-2xl border border-zinc-200\/80 bg-zinc-50\/50/);
    });

    it("renders categories in a responsive 3-column grid", () => {
      assert.match(breakdownCode, /grid grid-cols-3 gap-4/);
    });
  });

  describe("3. Mobile Layout (320px–767px)", () => {
    it("displays overall rating and review count at the top", () => {
      assert.match(breakdownCode, /block md:hidden/);
      assert.match(breakdownCode, /displayAverageRating/);
      assert.match(breakdownCode, /reviews_count_singular/);
      assert.match(breakdownCode, /reviews_count_plural/);
    });

    it("displays rating distribution bars below rating header", () => {
      assert.match(breakdownCode, /border-t border-zinc-200\/70 pt-3/);
      assert.match(breakdownCode, /Rating star distribution/);
    });

    it("displays the 6 categories in a clean 2-column grid without text overlapping", () => {
      assert.match(breakdownCode, /grid grid-cols-2 gap-3/);
      assert.match(breakdownCode, /truncate text-xs sm:text-sm font-medium/);
      assert.match(breakdownCode, /min-w-0/);
      assert.match(breakdownCode, /ReviewIcon name=\{icon\} className="size-5 text-zinc-700"/);
    });
  });

  describe("4. Integration & Review List", () => {
    it("ReviewList passes averageRating to ReviewBreakdown", () => {
      assert.match(reviewListCode, /<ReviewBreakdown[\s\S]*?averageRating=\{stats\.averageRating\}/);
    });
  });
});

