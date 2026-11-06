import { NextRequest, NextResponse } from "next/server";
import { guestLtvService } from "@/services/admin-analytics/lifetime/guest-ltv.service";
import { hostLtvService } from "@/services/admin-analytics/lifetime/host-ltv.service";
import { churnPredictionService } from "@/services/admin-analytics/lifetime/churn-prediction.service";

/**
 * Customer & Host Lifetime Intelligence & Churn API Route - Phase 9
 * GET /api/v1/admin/analytics/lifetime
 * POST /api/v1/admin/analytics/lifetime
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "guest_ltv";

    if (action === "guest_ltv") {
      const metrics = await guestLtvService.computeGuestLtv();
      return NextResponse.json({ success: true, metrics });
    }

    if (action === "host_ltv") {
      const metrics = await hostLtvService.computeHostLtv();
      return NextResponse.json({ success: true, metrics });
    }

    if (action === "churn_evaluation") {
      const evaluation = churnPredictionService.evaluateModelPerformance();
      return NextResponse.json({ success: true, evaluation });
    }

    return NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action || "predict_guest_churn";

    if (action === "predict_guest_churn") {
      const {
        guestId = "guest_sample",
        daysSinceLastBooking = 45,
        averageBookingFrequencyDays = 45,
        cancelledBookingsCount = 0,
        totalCompletedBookings = 2,
      } = body;

      const assessment = churnPredictionService.evaluateGuestChurnRisk({
        guestId,
        daysSinceLastBooking,
        averageBookingFrequencyDays,
        cancelledBookingsCount,
        totalCompletedBookings,
      });

      return NextResponse.json({ success: true, assessment });
    }

    if (action === "predict_host_churn") {
      const {
        hostId = "host_sample",
        daysSinceLastListingActivity = 30,
        activeListingsCount = 2,
        unpublishedListingsCount = 0,
        calendarBlockedDaysPct = 10,
        isSeasonalOffPeak = false,
      } = body;

      const assessment = churnPredictionService.evaluateHostChurnRisk({
        hostId,
        daysSinceLastListingActivity,
        activeListingsCount,
        unpublishedListingsCount,
        calendarBlockedDaysPct,
        isSeasonalOffPeak,
      });

      return NextResponse.json({ success: true, assessment });
    }

    return NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

