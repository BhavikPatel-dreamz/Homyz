import { SecurityDashboard } from "@/components/admin/security-dashboard";
import { AdminPageHeader } from "@/components/admin/ui/admin-page-header";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { auditService } from "@/services/audit.service";

export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  await requirePagePermission(PERMISSIONS.SECURITY_LOGS_VIEW);

  const [stats, failedEvents] = await Promise.all([
    auditService.getSecurityStats(),
    auditService.listFailedSecurityEvents(),
  ]);

  return (
    <div className="flex flex-col gap-6 font-sans">
      <AdminPageHeader
        title="Security Monitoring"
        description="Real-time visibility into authentication health, failed access attempts, and policy enforcement."
        badge={{
          label: stats.failedLogins24h > 0 ? `${stats.failedLogins24h} Failed Logins (24h)` : "Security Healthy",
          variant: stats.failedLogins24h > 5 ? "danger" : stats.failedLogins24h > 0 ? "warning" : "success",
        }}
      />

      <SecurityDashboard stats={stats} failedEvents={failedEvents} />
    </div>
  );
}
