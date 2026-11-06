import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  erpAccountMappingService,
  HOMYZ_LEDGER_ROLES,
} from "@/services/admin-analytics/accounting/account-mapping.service";
import { AppError } from "@/lib/api/errors";
import type { AccountingProvider } from "@/services/admin-analytics/accounting/accounting-contracts";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  await requireApiPermission(req, [PERMISSIONS.REPORTS_VIEW, PERMISSIONS.ANALYTICS_VIEW]);

  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId") || "default_tenant";
  const provider = (searchParams.get("provider") as AccountingProvider) || "QUICKBOOKS";

  const [activeMapping, versions] = await Promise.all([
    erpAccountMappingService.getActiveMapping(tenantId, provider),
    erpAccountMappingService.listMappingVersions(tenantId, provider),
  ]);

  return ok({
    tenantId,
    provider,
    activeMapping,
    versions,
    ledgerRoles: Object.values(HOMYZ_LEDGER_ROLES),
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.SYSTEM_MANAGE,
    PERMISSIONS.ANALYTICS_VIEW,
  ]);

  const body = await req.json().catch(() => ({}));
  const { action, tenantId = "default_tenant", provider = "QUICKBOOKS", mappingId, mappings, availableAccounts } = body;

  if (action === "CREATE_DRAFT") {
    const draft = await erpAccountMappingService.createDraftMapping({
      tenantId,
      provider,
      actorId: actor.id,
      initialMappings: mappings,
    });
    return ok(draft);
  }

  if (action === "VALIDATE") {
    if (!mappingId) throw AppError.badRequest("Field 'mappingId' is required.");
    const versions = await erpAccountMappingService.listMappingVersions(tenantId, provider);
    const target = versions.find((v) => v.id === mappingId);
    if (!target) throw AppError.notFound(`Mapping ${mappingId} not found.`);

    const validation = erpAccountMappingService.validateMapping(target, availableAccounts);
    return ok(validation);
  }

  if (action === "ACTIVATE") {
    if (!mappingId) throw AppError.badRequest("Field 'mappingId' is required.");
    const activated = await erpAccountMappingService.activateMapping(mappingId, availableAccounts);
    return ok(activated);
  }

  throw AppError.badRequest(`Unsupported action: ${action}`);
});

