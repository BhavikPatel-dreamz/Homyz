import { SessionManager } from "@/components/admin/session-manager";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { sessionService } from "@/services/session.service";

export default async function AdminSessionsPage() {
  await requirePagePermission(PERMISSIONS.SESSIONS_VIEW);

  const activeSessions = await sessionService.listAllActive(100);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1>
          Active Sessions
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
          Inspect currently logged-in web and mobile clients across all devices and terminate suspicious sessions.
        </p>
      </div>

      <SessionManager initialSessions={activeSessions} />
    </div>
  );
}
