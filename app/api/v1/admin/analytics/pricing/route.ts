import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import { recommendationEngineService } from "@/services/pricing-intelligence/recommendation-engine.service";
import { pricingValidationService } from "@/services/pricing-intelligence/pricing-validation.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/analytics/pricing
 * Retrieves pricing recommendations and constraints for a listing.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireApiRole(req, [Role.ADMIN]);

    const { searchParams } = new URL(req.url);
    const listingId = searchParams.get("listingId");
    if (!listingId) {
      throw AppError.badRequest("Query parameter 'listingId' is required.");
    }

    const horizonDays = parseInt(searchParams.get("horizonDays") || "30", 10);
    const result = await recommendationEngineService.generateRecommendations({
      listingId,
      horizonDays,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || "Failed to generate pricing recommendations." },
      { status }
    );
  }
}

/**
 * POST /api/v1/admin/analytics/pricing
 * Accepts, rejects, or reverts pricing recommendations.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireApiRole(req, [Role.ADMIN]);

    const body = await req.json();
    const { action, listingId, dates, auditRecordIds, reason } = body;

    if (!listingId) {
      throw AppError.badRequest("Field 'listingId' is required.");
    }

    if (action === "ACCEPT") {
      if (!Array.isArray(dates) || dates.length === 0) {
        throw AppError.badRequest("Field 'dates' must be a non-empty array of { dateKey, priceCents }.");
      }
      const res = await pricingValidationService.acceptRecommendations({
        actor: user,
        listingId,
        acceptedDates: dates,
        reason,
      });
      return NextResponse.json({ success: true, data: res });
    }

    if (action === "REVERT") {
      if (!Array.isArray(auditRecordIds) || auditRecordIds.length === 0) {
        throw AppError.badRequest("Field 'auditRecordIds' must be a non-empty array.");
      }
      const res = await pricingValidationService.revertRecentChanges({
        actor: user,
        listingId,
        auditRecordIds,
      });
      return NextResponse.json({ success: true, data: res });
    }

    if (action === "REJECT") {
      const { dateKey, suggestedPriceCents } = body;
      const res = pricingValidationService.logRejection({
        actor: user,
        listingId,
        dateKey,
        suggestedPriceCents: suggestedPriceCents || 0,
        reason,
      });
      return NextResponse.json({ success: true, data: res });
    }

    throw AppError.badRequest(`Unsupported action: ${action}`);
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || "Pricing action failed." },
      { status }
    );
  }
}

