import { NextRequest, NextResponse } from "next/server";
import { executiveBoardReportingService } from "@/services/admin-analytics/executive/executive-board-reporting.service";

/**
 * Executive Board Reporting API Route - Phase 10
 * GET /api/v1/admin/analytics/executive
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "2026-10";
    const currency = (searchParams.get("currency") || "USD").toUpperCase() as "SAR" | "USD" | "EUR" | "GBP";

    const boardPackage = await executiveBoardReportingService.generateBoardPackage({
      period,
      presentationCurrency: currency,
      actorId: "executive_api_user",
    });

    return NextResponse.json({
      success: true,
      boardPackage,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

