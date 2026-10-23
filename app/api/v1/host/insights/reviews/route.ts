import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { AppError } from "@/lib/api/errors";
import { Role } from "@/generated/prisma/enums";
import { hostInsightsService } from "@/services/host-insights.service";
import { hostReviewsInsightsService } from "@/services/host-reviews-insights.service";
import { parseInsightsReportingFilters } from "@/lib/dashboard/insights-query";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const url = new URL(req.url);

  const filters = parseInsightsReportingFilters(url);

  const page = url.searchParams.get("page") ? parseInt(url.searchParams.get("page")!, 10) : 1;
  const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : 10;
  const sort = (url.searchParams.get("sort") as "recent" | "oldest" | "highest" | "lowest") || "recent";
  const search = url.searchParams.get("search") || undefined;
  const rating = url.searchParams.get("rating") ? parseInt(url.searchParams.get("rating")!, 10) : undefined;
  const repliedStatus = (url.searchParams.get("repliedStatus") as "all" | "replied" | "unreplied") || "all";
  const category = (url.searchParams.get("category") || undefined) as "cleanliness" | "accuracy" | "checkIn" | "communication" | "location" | "value" | undefined;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw AppError.badRequest("Page must be positive and limit must be between 1 and 50.");
  }
  if (!["recent", "oldest", "highest", "lowest"].includes(sort)) {
    throw AppError.badRequest("Unsupported review sort.");
  }
  if (rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw AppError.badRequest("Rating must be an integer between 1 and 5.");
  }
  if (!["all", "replied", "unreplied"].includes(repliedStatus)) {
    throw AppError.badRequest("Unsupported reply status.");
  }
  if (category && !["cleanliness", "accuracy", "checkIn", "communication", "location", "value"].includes(category)) {
    throw AppError.badRequest("Unsupported review category.");
  }

  const [data, reviewsOverview, reviewsResult] = await Promise.all([
    hostInsightsService.getInsights(actor, {
      tab: "reviews",
      ...filters,
    }),
    hostReviewsInsightsService.getReviewsOverview(actor.id, {
      listingId: filters.listingId,
      period: filters.period,
      startDate: filters.startDate,
      endDate: filters.endDate,
    }),
    hostReviewsInsightsService.listHostReviews(actor.id, {
      listingId: filters.listingId,
      period: filters.period,
      startDate: filters.startDate,
      endDate: filters.endDate,
      rating,
      repliedStatus,
      category,
      search,
      sort,
      page,
      limit,
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      overview: reviewsOverview,
      items: reviewsResult.reviews,
      pagination: reviewsResult.pagination,
      reviews: {
        ...data.reviews,
        qualitySummary: reviewsOverview.qualitySummary,
        trends: reviewsOverview.trends,
      },
      selectedListingId: data.selectedListingId,
      reportingPeriod: data.reportingPeriod,
      listings: data.listings,
    },
  });
});
