import { ActivityLogViewer } from "@/components/admin/activity-log-viewer";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { auditService } from "@/services/audit.service";

export default async function AdminActivityLogsPage() {
  await requirePagePermission(PERMISSIONS.ACTIVITY_LOGS_VIEW);

  const logsRes = await auditService.list({ limit: 100 });

  return (
    <ActivityLogViewer
      initialLogs={logsRes.items}
      pagination={logsRes.pagination}
    />
  );
}
