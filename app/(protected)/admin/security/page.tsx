import { SecurityDashboard } from "@/components/admin/security-dashboard";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { auditService } from "@/services/audit.service";

export default async function AdminSecurityPage() {
  await requirePagePermission(PERMISSIONS.SECURITY_LOGS_VIEW);

  const [stats, failedEvents] = await Promise.all([
    auditService.getSecurityStats(),
    auditService.listFailedSecurityEvents(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1>
          Security Monitoring
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
          Real-time visibility into authentication health, failed access attempts, and policy enforcement.
        </p>
      </div>

      <SecurityDashboard stats={stats} failedEvents={failedEvents} />
    </div>
  );
}
