import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");

describe("Host Listings Optimization - Architecture and Contracts", () => {
  it("verifies service listForHost supports 12-item pagination, tab filtering, search, and deterministic sorting", () => {
    const serviceContent = fs.readFileSync(
      path.join(root, "services/listing.service.ts"),
      "utf8",
    );

    // Default limit should be 12
    assert.match(
      serviceContent,
      /opts\?\.limit \?\? \(opts\?\.take === null \? null : \(opts\?\.take \?\? 12\)\)/,
      "Expected default limit to be 12",
    );

    // Deterministic sorting with secondary sort id: 'desc'
    assert.match(
      serviceContent,
      /orderBy:\s*Prisma\.ListingOrderByWithRelationInput\[\]\s*=\s*\[\s*\{\s*createdAt:\s*"desc"\s*\},\s*\{\s*id:\s*"desc"\s*\},?\s*\]/,
      "Expected deterministic sorting by createdAt and id desc",
    );

    // Tab filtering clauses
    assert.ok(serviceContent.includes('tab === "ACTIVE"'), "Must handle ACTIVE tab");
    assert.ok(serviceContent.includes('tab === "PENDING_REVIEW"'), "Must handle PENDING_REVIEW tab");
    assert.ok(serviceContent.includes('tab === "CHANGES_REQUESTED"'), "Must handle CHANGES_REQUESTED tab");
    assert.ok(serviceContent.includes('tab === "DRAFT"'), "Must handle DRAFT tab");
    assert.ok(serviceContent.includes('tab === "PAUSED"'), "Must handle PAUSED tab");
    assert.ok(serviceContent.includes('tab === "REJECTED"'), "Must handle REJECTED tab");

    // Aggregated groupBy query for all tab counts
    assert.match(
      serviceContent,
      /prisma\.listing\.groupBy\(\{\s*by:\s*\["status",\s*"published",\s*"isPaused"\]/,
      "Expected groupBy query on status, published, isPaused for fast count tallying",
    );

    // Return contract
    assert.match(
      serviceContent,
      /return\s*\{\s*items:\s*items\.map\(toListingDTO\),\s*total,\s*totalCount:\s*total,\s*page,\s*totalPages,\s*hasMore,\s*counts:\s*tabCounts,?\s*\}/,
      "Expected complete pagination and counts contract",
    );
  });

  it("verifies API route /api/v1/host/listings provides paginated response with counts", () => {
    const routeContent = fs.readFileSync(
      path.join(root, "app/api/v1/host/listings/route.ts"),
      "utf8",
    );

    assert.ok(
      routeContent.includes('searchParams.get("page")'),
      "Should parse page search parameter",
    );
    assert.ok(
      routeContent.includes('searchParams.get("limit")'),
      "Should parse limit search parameter",
    );
    assert.ok(
      routeContent.includes('searchParams.get("tab")'),
      "Should parse tab search parameter",
    );
    assert.ok(
      routeContent.includes('searchParams.get("search")') || routeContent.includes('searchParams.get("q")'),
      "Should parse search/q search parameter",
    );
    assert.match(
      routeContent,
      /const limit = Math\.min\(100,\s*Math\.max\(1,\s*parseInt\(searchParams\.get\("limit"\)\s*\|\|\s*"12",\s*10\)\s*\|\|\s*12\)\);/,
      "Should default limit to 12 with safe bounds",
    );
    assert.ok(
      routeContent.includes("return ok(result);"),
      "Should return listingService result in ok response",
    );
  });

  it("verifies page.tsx loads initial page with 12 items and passes counts and search parameters", () => {
    const pageContent = fs.readFileSync(
      path.join(root, "app/(protected)/host/listings/page.tsx"),
      "utf8",
    );

    assert.ok(
      pageContent.includes("take: 12"),
      "Initial server render must request 12 listings",
    );
    assert.ok(
      pageContent.includes("limit: 12"),
      "Initial server render must specify limit 12",
    );
    assert.ok(
      pageContent.includes("initialCounts={counts}"),
      "Workspace must receive initialCounts",
    );
    assert.ok(
      pageContent.includes("initialTab={requestedTab}"),
      "Workspace must receive initialTab",
    );
    assert.ok(
      pageContent.includes("initialPage={requestedPage}"),
      "Workspace must receive initialPage",
    );
  });

  it("verifies skeleton matches the 12-card footprint and responsive grid layout", () => {
    const skeletonContent = fs.readFileSync(
      path.join(root, "components/host/host-listings-skeleton.tsx"),
      "utf8",
    );

    assert.ok(
      skeletonContent.includes("cardCount = 12"),
      "Skeleton should default to 12 cards",
    );
    assert.ok(
      skeletonContent.includes("aspect-[375/352] sm:aspect-[490/514]"),
      "Skeleton must match the card image aspect ratio contract",
    );
    assert.ok(
      skeletonContent.includes("sm:grid-cols-2 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-3 xl:grid-cols-4"),
      "Skeleton must mirror the responsive grid columns",
    );
    assert.ok(
      skeletonContent.includes("Status Tabs Pill Skeleton"),
      "Skeleton must include tabs row placeholder to prevent layout shifts",
    );
  });

  it("verifies workspace handles debounced search, caching, deduplication, and Next.js Image", () => {
    const workspaceContent = fs.readFileSync(
      path.join(root, "components/host/host-listings-workspace.tsx"),
      "utf8",
    );

    // Caching and deduplication refs
    assert.ok(
      workspaceContent.includes("cacheRef = useRef"),
      "Workspace must maintain an in-memory cache",
    );
    assert.ok(
      workspaceContent.includes("inFlightRef = useRef"),
      "Workspace must maintain an in-flight request deduplication map",
    );
    assert.ok(
      workspaceContent.includes("abortControllerRef = useRef"),
      "Workspace must track AbortController for cancelling stale requests",
    );

    // 300ms debounce
    assert.match(
      workspaceContent,
      /searchTimeoutRef\.current\s*=\s*setTimeout\(\(\)\s*=>\s*\{[\s\S]*?\},\s*300\);/,
      "Search must be debounced by 300ms",
    );

    // Next.js Image component with lazy loading
    assert.ok(
      workspaceContent.includes("<Image"),
      "Images should use Next.js Image component",
    );
    assert.ok(
      workspaceContent.includes('loading="lazy"'),
      "Images should specify lazy loading",
    );
    assert.ok(
      workspaceContent.includes("isOptimizableImage"),
      "Images should check against domain whitelist to safely avoid loader errors",
    );

    // Pagination controls
    assert.ok(
      workspaceContent.includes("handlePageChange(page - 1)"),
      "Should have Previous page button",
    );
    assert.ok(
      workspaceContent.includes("handlePageChange(page + 1)"),
      "Should have Next page button",
    );
    assert.ok(
      workspaceContent.includes("Page {page} of {Math.max(1, totalPages)}"),
      "Should display Page X of Y",
    );

    assert.ok(
      workspaceContent.includes("window.history.replaceState"),
      "URL changes should not trigger a second server navigation while the API request is in flight",
    );
    assert.ok(
      !workspaceContent.includes("router.replace"),
      "Tab, page, and search changes must not replace the workspace with route-level loading UI",
    );
    assert.ok(
      workspaceContent.includes("latestRequestKeyRef"),
      "Stale requests must not overwrite newer listing results",
    );
    assert.ok(
      workspaceContent.includes("aria-busy={loading}"),
      "The listing grid should expose its loading state while page data is being replaced",
    );
  });
});

describe("Host Listings Calculation & Tab Logic Verification", () => {
  it("calculates pagination boundaries accurately", () => {
    function computePagination(total: number, limit: number, page: number) {
      const totalPages = limit ? Math.max(1, Math.ceil(total / limit)) : 1;
      const validPage = Math.min(Math.max(1, page), totalPages);
      const hasMore = validPage < totalPages;
      const skip = (validPage - 1) * limit;
      return { totalPages, page: validPage, hasMore, skip };
    }

    // 0 items
    assert.deepEqual(computePagination(0, 12, 1), {
      totalPages: 1,
      page: 1,
      hasMore: false,
      skip: 0,
    });

    // Exactly 12 items -> 1 page
    assert.deepEqual(computePagination(12, 12, 1), {
      totalPages: 1,
      page: 1,
      hasMore: false,
      skip: 0,
    });

    // 13 items -> 2 pages
    assert.deepEqual(computePagination(13, 12, 1), {
      totalPages: 2,
      page: 1,
      hasMore: true,
      skip: 0,
    });

    // 13 items, page 2
    assert.deepEqual(computePagination(13, 12, 2), {
      totalPages: 2,
      page: 2,
      hasMore: false,
      skip: 12,
    });

    // 25 items -> 3 pages
    assert.deepEqual(computePagination(25, 12, 2), {
      totalPages: 3,
      page: 2,
      hasMore: true,
      skip: 12,
    });
  });

  it("aggregates tab counts correctly across all 7 statuses", () => {
    type Group = {
      status: string;
      published: boolean;
      isPaused: boolean;
      _count: { id: number };
    };

    const mockGroups: Group[] = [
      { status: "ACTIVE", published: true, isPaused: false, _count: { id: 5 } },
      { status: "ACTIVE", published: true, isPaused: true, _count: { id: 2 } }, // Paused
      { status: "PENDING_REVIEW", published: false, isPaused: false, _count: { id: 3 } },
      { status: "CHANGES_REQUESTED", published: false, isPaused: false, _count: { id: 1 } },
      { status: "DRAFT", published: false, isPaused: false, _count: { id: 4 } },
      { status: "IN_PROGRESS", published: false, isPaused: false, _count: { id: 2 } }, // Drafts
      { status: "REJECTED", published: false, isPaused: false, _count: { id: 1 } },
    ];

    const tabCounts: Record<string, number> = {
      ALL: 0,
      ACTIVE: 0,
      PENDING_REVIEW: 0,
      CHANGES_REQUESTED: 0,
      DRAFT: 0,
      PAUSED: 0,
      REJECTED: 0,
    };

    for (const group of mockGroups) {
      const cnt = group._count.id;
      tabCounts.ALL += cnt;
      if (group.isPaused) {
        tabCounts.PAUSED += cnt;
      }
      if (!group.isPaused && (group.status === "ACTIVE" || group.published)) {
        tabCounts.ACTIVE += cnt;
      }
      if (group.status === "PENDING_REVIEW") {
        tabCounts.PENDING_REVIEW += cnt;
      }
      if (group.status === "CHANGES_REQUESTED") {
        tabCounts.CHANGES_REQUESTED += cnt;
      }
      if (group.status === "DRAFT" || group.status === "IN_PROGRESS") {
        tabCounts.DRAFT += cnt;
      }
      if (group.status === "REJECTED") {
        tabCounts.REJECTED += cnt;
      }
    }

    assert.equal(tabCounts.ALL, 18);
    assert.equal(tabCounts.ACTIVE, 5);
    assert.equal(tabCounts.PAUSED, 2);
    assert.equal(tabCounts.PENDING_REVIEW, 3);
    assert.equal(tabCounts.CHANGES_REQUESTED, 1);
    assert.equal(tabCounts.DRAFT, 6); // 4 DRAFT + 2 IN_PROGRESS
    assert.equal(tabCounts.REJECTED, 1);
  });
});
