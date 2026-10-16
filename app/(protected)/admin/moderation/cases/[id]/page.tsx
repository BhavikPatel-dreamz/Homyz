import { notFound } from "next/navigation";

import { requirePagePermission } from "@/lib/permissions/page-guards";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";
import { moderationService } from "@/services/moderation.service";
import { AppError } from "@/lib/api/errors";
import { ModerationSetupPending } from "@/components/admin/moderation-setup-pending";
import { AdminModerationCaseDetailsClient } from "./admin-moderation-case-details-client";

export const dynamic = "force-dynamic";

export default async function AdminModerationCasePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePagePermission(PERMISSIONS.MODERATION_CASE_READ);
  const { id } = await params;
  let details;
  let unavailableMessage: string | null = null;
  try {
    details = await moderationService.getModerationCaseDetails(actor, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 503) {
      unavailableMessage = error.message;
    } else if (error instanceof AppError && (error.status === 403 || error.status === 404)) {
      // Do not reveal whether a protected case exists to an actor without access.
      notFound();
    } else {
      // Unexpected data or infrastructure failures must reach the route error
      // boundary; treating them as a missing case masks actionable defects.
      throw error;
    }
  }
  if (unavailableMessage || !details) return <ModerationSetupPending message={unavailableMessage || undefined} />;
  return (
    <AdminModerationCaseDetailsClient
      initialDetails={details}
      canUpdate={hasPermission(actor, PERMISSIONS.MODERATION_CASE_UPDATE)}
      canAssign={hasPermission(actor, PERMISSIONS.MODERATION_CASE_ASSIGN)}
      canDecide={hasPermission(actor, PERMISSIONS.MODERATION_DECISION_CREATE)}
      canEnforce={hasPermission(actor, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE)}
    />
  );
}
