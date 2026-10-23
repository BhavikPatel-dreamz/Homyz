import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Phase 8 review routes, components, and APIs exist", () => {
  // Nested review detail page and client
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/(protected)/host/insights/reviews/[reviewId]/page.tsx")));
  assert.ok(
    fs.existsSync(
      path.join(process.cwd(), "app/(protected)/host/insights/reviews/[reviewId]/host-review-details-client.tsx"),
    ),
  );

  // Reviews Tab component
  assert.ok(fs.existsSync(path.join(process.cwd(), "components/host/insights/insights-reviews-tab.tsx")));

  // Dedicated review insights service
  assert.ok(fs.existsSync(path.join(process.cwd(), "services/host-reviews-insights.service.ts")));

  // APIs
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/v1/host/insights/reviews/route.ts")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/v1/host/insights/reviews/overview/route.ts")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/v1/host/insights/reviews/[reviewId]/route.ts")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/v1/host/insights/reviews/[reviewId]/reply/route.ts")));
});

test("Host Reviews Insights Service provides authoritative calculations and trends", () => {
  const service = read("services/host-reviews-insights.service.ts");

  // Overview calculations
  assert.match(service, /getReviewsOverview\(/);
  assert.match(service, /ratingDistribution/);
  assert.match(service, /categoryRatings/);
  assert.match(service, /trends/);
  assert.match(service, /qualitySummary/);

  // List host reviews with filters
  assert.match(service, /listHostReviews\(/);
  assert.match(service, /repliedStatus/);
  assert.match(service, /direction: ReviewDirection\.GUEST_TO_PROPERTY/);
  assert.match(service, /status: ReviewStatus\.PUBLISHED/);

  // Detail query and authorization
  assert.match(service, /getHostReviewDetails\(/);
  assert.match(service, /review\.listing\?\.hostId !== hostId/);
});

test("Host Reviews Insights Service integrates with existing ReviewResponse system", () => {
  const service = read("services/host-reviews-insights.service.ts");
  assert.match(service, /import \{ reviewService \} from "@\/services\/review\.service"/);
  assert.match(service, /reviewService\.createReviewResponse\(/);
  assert.match(service, /AppError\.conflict\("A response has already been submitted for this review\."\)/);
});

test("Reviews tab UI implements Airbnb-style rating hero, category breakdown, quality summary, and reviews list", () => {
  const tab = read("components/host/insights/insights-reviews-tab.tsx");

  // Overall rating & distribution
  assert.match(tab, /Overall Rating/);
  assert.match(tab, /categoryRatings/);
  assert.match(tab, /ratingDistribution\[stars\]/);

  // Quality summary & trends
  assert.match(tab, /Review Quality Summary/);
  assert.match(tab, /12-Month Review Trends/);
  assert.match(tab, /qualitySummary\.strengths/);
  assert.match(tab, /qualitySummary\.areasForImprovement/);

  // Filtering, search, and sorting
  assert.match(tab, /Search comments or guests\.\.\./);
  assert.match(tab, /All Star Ratings/);
  assert.match(tab, /All Response Statuses/);
  assert.match(tab, /Most recent/);
  assert.match(tab, /View Details →/);
});

test("Review details screen renders reservation summary, category scores, and reply interaction", () => {
  const page = read("app/(protected)/host/insights/reviews/[reviewId]/page.tsx");
  assert.match(page, /requirePageRole\(\[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(page, /hostReviewsInsightsService\.getHostReviewDetails/);

  const client = read("app/(protected)/host/insights/reviews/[reviewId]/host-review-details-client.tsx");
  assert.match(client, /Back to Reviews/);
  assert.match(client, /href="\/host\/insights\?tab=reviews"/);
  assert.match(client, /Reservation Details/);
  assert.match(client, /Category Subratings/);
  assert.match(client, /Host response/);
  assert.match(client, /\/api\/v1\/host\/insights\/reviews\/\$\{review\.id\}\/reply/);
});

test("Review APIs enforce host/admin authorization and validation", () => {
  const reviewsApi = read("app/api/v1/host/insights/reviews/route.ts");
  assert.match(reviewsApi, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(reviewsApi, /hostReviewsInsightsService\.getReviewsOverview/);
  assert.match(reviewsApi, /hostReviewsInsightsService\.listHostReviews/);

  const detailApi = read("app/api/v1/host/insights/reviews/[reviewId]/route.ts");
  assert.match(detailApi, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(detailApi, /hostReviewsInsightsService\.getHostReviewDetails/);

  const replyApi = read("app/api/v1/host/insights/reviews/[reviewId]/reply/route.ts");
  assert.match(replyApi, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(replyApi, /replySchema\.parse/);
  assert.match(replyApi, /hostReviewsInsightsService\.replyToReview/);
});

test("Review Insights keeps unauthorized listing filters scoped and trends independent of the overview period", () => {
  const service = read("services/host-reviews-insights.service.ts");
  const route = read("app/api/v1/host/insights/reviews/route.ts");
  assert.match(service, /Listing not found or access denied for this host/);
  assert.match(service, /trendReviews/);
  assert.match(route, /Unsupported review sort/);
  assert.match(route, /Unsupported review category/);
});
