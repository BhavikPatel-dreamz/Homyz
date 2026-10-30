import { NotificationOutboxMonitor } from "@/components/admin/support/notification-outbox-monitor";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export const dynamic = "force-dynamic";

export default async function AdminSupportNotificationPage() {
  await requirePagePermission(PERMISSIONS.NOTIFICATIONS_VIEW);
  return <NotificationOutboxMonitor />;
}
