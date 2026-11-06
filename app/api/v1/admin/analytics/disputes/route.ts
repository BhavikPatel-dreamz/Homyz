import { NextRequest, NextResponse } from "next/server";
import { operationalRiskService } from "@/services/admin-analytics/disputes/operational-risk.service";
import { caseSummaryService } from "@/services/admin-analytics/disputes/case-summary.service";
import { anomalyMonitorService } from "@/services/admin-analytics/disputes/anomaly-monitor.service";
import type { AnomalyAlertStatus } from "@/services/admin-analytics/disputes/dispute-contracts";

/**
 * Dispute Intelligence & Anomaly Monitoring API Route - Phase 9
 * GET /api/v1/admin/analytics/disputes
 * POST /api/v1/admin/analytics/disputes
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "alerts";

    if (action === "risk") {
      const caseId = searchParams.get("caseId");
      if (!caseId) {
        return NextResponse.json({ success: false, error: "Missing caseId parameter" }, { status: 400 });
      }
      const assessment = await operationalRiskService.evaluateCaseRisk(caseId);
      return NextResponse.json({ success: true, assessment });
    }

    if (action === "summary") {
      const caseId = searchParams.get("caseId");
      if (!caseId) {
        return NextResponse.json({ success: false, error: "Missing caseId parameter" }, { status: 400 });
      }
      const summary = await caseSummaryService.generateCaseSummary(caseId);
      return NextResponse.json({ success: true, summary });
    }

    if (action === "alerts") {
      const status = searchParams.get("status") as AnomalyAlertStatus | undefined;
      const alerts = anomalyMonitorService.listAlerts(status);
      return NextResponse.json({ success: true, count: alerts.length, alerts });
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
    const action = body.action || "evaluate_risk";

    if (action === "evaluate_risk") {
      const {
        entityType = "SUPPORT_CASE",
        entityId = "unknown",
        paymentFailuresCount,
        paymentAttemptsCount,
        hasDuplicatePaymentRef,
        refundRequestedCents,
        eligibleBookingCents,
        refundFailuresCount,
        isSlaBreached,
        isEscalated,
        priorComplaintsCount,
        isReopened,
        cancellationRatePct,
      } = body;

      const assessment = operationalRiskService.evaluateRisk({
        entityType,
        entityId,
        paymentFailuresCount,
        paymentAttemptsCount,
        hasDuplicatePaymentRef,
        refundRequestedCents,
        eligibleBookingCents,
        refundFailuresCount,
        isSlaBreached,
        isEscalated,
        priorComplaintsCount,
        isReopened,
        cancellationRatePct,
      });

      return NextResponse.json({ success: true, assessment });
    }

    if (action === "alert_status") {
      const { alertId, status, actorId = "admin" } = body;
      if (!alertId || !status) {
        return NextResponse.json({ success: false, error: "Missing alertId or status" }, { status: 400 });
      }
      const updated = anomalyMonitorService.updateAlertStatus(alertId, status, actorId);
      return NextResponse.json({ success: true, alert: updated });
    }

    return NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

