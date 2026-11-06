import { NextRequest, NextResponse } from "next/server";
import { systemHealthService } from "@/services/admin-analytics/system-health/system-health.service";

/**
 * System Health, Observability & SOC 2 Readiness API Route - Phase 10
 * GET /api/v1/admin/analytics/system-health
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "overview";

    if (action === "overview") {
      const overview = await systemHealthService.getSystemHealth();
      return NextResponse.json({ success: true, overview });
    }

    if (action === "soc2") {
      const controls = systemHealthService.getSoc2Controls();
      return NextResponse.json({ success: true, count: controls.length, controls });
    }

    if (action === "disaster_recovery") {
      const dr = systemHealthService.getDisasterRecoveryStatus();
      return NextResponse.json({ success: true, disasterRecovery: dr });
    }

    return NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

