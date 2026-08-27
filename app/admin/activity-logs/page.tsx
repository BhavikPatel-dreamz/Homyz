import { ActivityLogViewer } from "@/components/admin/activity-log-viewer";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { auditService } from "@/services/audit.service";

export default async function AdminActivityLogsPage() {
  await requirePagePermission(PERMISSIONS.ACTIVITY_LOGS_VIEW);

  const logsRes = await auditService.list({ limit: 100 });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 ">
          Activity & Audit Logs
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Comprehensive, immutable audit trail of logins, administrative modifications, and security events.
        </p>
      </div>

      <ActivityLogViewer
        initialLogs={logsRes.items}
        pagination={logsRes.pagination}
      />
    </div>
  );
}
