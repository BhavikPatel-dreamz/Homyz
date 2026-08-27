import { SecurityDashboard } from "@/components/admin/security-dashboard";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { auditService } from "@/services/audit.service";
import { prisma } from "@/lib/db/prisma";

export default async function AdminSecurityPage() {
  await requirePagePermission(PERMISSIONS.SECURITY_LOGS_VIEW);

  const [stats, failedEvents] = await Promise.all([
    auditService.getSecurityStats(),
    prisma.auditLog.findMany({
      where: {
        OR: [
          { status: "FAILURE" },
          { action: "LOGIN_FAILED" },
        ],
      },
      take: 20,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        actorEmail: true,
        ip: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 ">
          Security Monitoring
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Real-time visibility into authentication health, failed access attempts, and policy enforcement.
        </p>
      </div>

      <SecurityDashboard stats={stats} failedEvents={failedEvents} />
    </div>
  );
}
