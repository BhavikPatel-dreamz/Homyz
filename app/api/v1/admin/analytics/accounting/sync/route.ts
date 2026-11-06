import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/enums";
import type { AuthUser } from "@/lib/auth/types";
import { twoWaySyncService } from "@/services/admin-analytics/accounting/two-way-sync.service";
import type {
  AccountingProvider,
  AccountingJournalEntry,
} from "@/services/admin-analytics/accounting/accounting-contracts";
import type {
  ErpConflictResolutionAction,
  ErpInboundPayload,
} from "@/services/admin-analytics/accounting/two-way-contracts";

/**
 * Two-Way ERP Synchronization & Conflict Management API - Phase 11
 * GET /api/v1/admin/analytics/accounting/sync
 * POST /api/v1/admin/analytics/accounting/sync
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "state";
    const provider = (searchParams.get("provider") as AccountingProvider) || "QUICKBOOKS";
    const entityId = searchParams.get("entityId") || "HOMYZ_SA_LTD";

    if (action === "state") {
      const state = await twoWaySyncService.getSyncState(provider, entityId);
      return NextResponse.json({ success: true, state });
    }

    if (action === "conflicts") {
      const unresolvedOnly = searchParams.get("unresolvedOnly") !== "false";
      const conflicts = await twoWaySyncService.getConflicts({
        provider,
        entityId,
        unresolvedOnly,
      });
      return NextResponse.json({ success: true, count: conflicts.length, conflicts });
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
    const action = body.action;

    // Simulated authenticated administrator for API interactions
    const actorUser: AuthUser = {
      id: body.actorId || "usr_cfo_admin",
      role: Role.ADMIN,
      email: "finance-admin@homyz.internal",
      name: "Finance Controller",
    };

    if (action === "export") {
      const {
        provider = "QUICKBOOKS",
        entityId = "HOMYZ_SA_LTD",
        journalEntries = [],
        trigger = "MANUAL_TRIGGER",
      } = body;

      const summary = await twoWaySyncService.exportJournalsToErp({
        provider: provider as AccountingProvider,
        entityId,
        journalEntries: journalEntries as AccountingJournalEntry[],
        trigger,
        user: actorUser,
      });

      return NextResponse.json({ success: true, summary });
    }

    if (action === "inbound_webhook") {
      const inboundPayload = body.payload as ErpInboundPayload;
      if (!inboundPayload || !inboundPayload.provider || !inboundPayload.entityId) {
        return NextResponse.json(
          { success: false, error: "Missing required inbound ERP payload fields" },
          { status: 400 }
        );
      }

      const result = await twoWaySyncService.processInboundErpPayload(inboundPayload, actorUser);
      return NextResponse.json({ success: result.success, result });
    }

    if (action === "resolve_conflict") {
      const { conflictId, resolutionAction, notes } = body;
      if (!conflictId || !resolutionAction) {
        return NextResponse.json(
          { success: false, error: "Missing conflictId or resolutionAction" },
          { status: 400 }
        );
      }

      const resolved = await twoWaySyncService.resolveConflict(
        conflictId,
        resolutionAction as ErpConflictResolutionAction,
        {
          notes,
          user: actorUser,
        }
      );

      return NextResponse.json({ success: true, conflict: resolved });
    }

    return NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

