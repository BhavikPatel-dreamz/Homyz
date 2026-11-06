import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { accountingSyncService } from "@/services/admin-analytics/accounting/accounting-sync.service";
import { accountingOAuthService } from "@/services/admin-analytics/accounting/oauth-service";
import { STANDARD_CHART_OF_ACCOUNTS } from "@/services/admin-analytics/accounting/accounting-mapping.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  await requireApiPermission(req, [
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
  ]);

  const [statuses, journals, syncRecords] = await Promise.all([
    accountingSyncService.getIntegrationStatuses(),
    accountingSyncService.listJournalEntries(),
    accountingSyncService.listSyncRecords(),
  ]);

  const oauthStatuses = accountingOAuthService.getDetailedProviderStatuses();

  return ok({
    providers: statuses,
    oauthStatuses,
    chartOfAccounts: Object.values(STANDARD_CHART_OF_ACCOUNTS),
    journals,
    syncRecords,
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.SYSTEM_MANAGE,
    PERMISSIONS.ANALYTICS_VIEW,
  ]);

  const body = await req.json().catch(() => ({}));
  const { action, provider = "QUICKBOOKS", journalEntryId } = body;

  // Handle OAuth initiation
  if (action === "INITIATE_OAUTH") {
    const origin = new URL(req.url).origin;
    const intent = accountingOAuthService.generateAuthorizationIntent({
      provider,
      actorId: actor.id,
      origin,
    });
    return ok(intent);
  }

  // Handle OAuth disconnection
  if (action === "DISCONNECT") {
    const disconnected = await accountingOAuthService.disconnectProvider(provider);
    return ok({ success: true, disconnected, provider });
  }

  // Default: Journal synchronization
  const result = await accountingSyncService.syncJournalEntry(actor, journalEntryId, provider);
  return ok(result);
});

