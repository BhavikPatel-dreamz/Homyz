import { NextRequest, NextResponse } from "next/server";
import { legalEntityService } from "@/services/admin-analytics/consolidation/legal-entity.service";
import { financialConsolidationService } from "@/services/admin-analytics/consolidation/financial-consolidation.service";

/**
 * Multi-Entity Financial Consolidation API Route - Phase 9
 * GET /api/v1/admin/analytics/consolidation
 * POST /api/v1/admin/analytics/consolidation
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "consolidated";

    if (action === "entities") {
      const entities = legalEntityService.listEntities();
      return NextResponse.json({ success: true, count: entities.length, entities });
    }

    if (action === "entity_performance") {
      const entityId = searchParams.get("entityId");
      if (!entityId) {
        return NextResponse.json({ success: false, error: "Missing entityId parameter" }, { status: 400 });
      }
      const period = searchParams.get("period") || "2026-10";
      const performance = financialConsolidationService.getEntityPerformance(entityId, period);
      return NextResponse.json({ success: true, performance });
    }

    if (action === "consolidated") {
      const currency = (searchParams.get("currency") || "USD").toUpperCase() as "SAR" | "USD" | "EUR" | "GBP";
      const period = searchParams.get("period") || "2026-10";
      const statement = await financialConsolidationService.generateConsolidatedStatement(currency, period);
      return NextResponse.json({ success: true, statement });
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
    const action = body.action || "register_entity";

    if (action === "register_entity") {
      const { entityId, legalName, countryCode, functionalCurrency, parentEntityId, erpProvider, erpTenantId } = body;
      if (!entityId || !legalName || !countryCode || !functionalCurrency) {
        return NextResponse.json(
          { success: false, error: "Missing required legal entity fields" },
          { status: 400 }
        );
      }

      const entity = legalEntityService.registerEntity({
        entityId,
        legalName,
        countryCode,
        functionalCurrency,
        parentEntityId: parentEntityId || null,
        erpProvider: erpProvider || "INTERNAL",
        erpTenantId: erpTenantId || `tenant_${entityId.toLowerCase()}`,
        status: "ACTIVE",
      });

      return NextResponse.json({ success: true, entity });
    }

    return NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

