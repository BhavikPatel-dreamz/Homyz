import { NextRequest, NextResponse } from "next/server";
import { financialReconciliationService } from "@/services/admin-analytics/reconciliation/financial-reconciliation.service";

/**
 * Financial Reconciliation & Self-Healing API Route - Phase 10
 * GET /api/v1/admin/analytics/reconciliation
 * POST /api/v1/admin/analytics/reconciliation
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "summary";

    if (action === "summary") {
      const summary = financialReconciliationService.getSummary();
      return NextResponse.json({ success: true, summary });
    }

    if (action === "discrepancies") {
      const status = searchParams.get("status") || undefined;
      const discrepancies = financialReconciliationService.getDiscrepancies(status);
      return NextResponse.json({ success: true, count: discrepancies.length, discrepancies });
    }

    if (action === "audit") {
      const history = financialReconciliationService.getAuditHistory(50);
      return NextResponse.json({ success: true, count: history.length, history });
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
    const action = body.action || "self_heal";

    if (action === "scan") {
      const scanned = await financialReconciliationService.scanDiscrepancies();
      return NextResponse.json({ success: true, count: scanned.length, discrepancies: scanned });
    }

    if (action === "self_heal") {
      const actorId = body.actorId || "admin";
      const result = await financialReconciliationService.executeSelfHealing(actorId);
      return NextResponse.json({ success: true, result });
    }

    if (action === "manual_resolve") {
      const { discrepancyId, resolutionAction, actorId = "admin", notes } = body;
      if (!discrepancyId || !resolutionAction) {
        return NextResponse.json(
          { success: false, error: "Missing discrepancyId or resolutionAction" },
          { status: 400 }
        );
      }
      const resolved = financialReconciliationService.manualResolve(
        discrepancyId,
        resolutionAction,
        actorId,
        notes
      );
      return NextResponse.json({ success: true, discrepancy: resolved });
    }

    return NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

