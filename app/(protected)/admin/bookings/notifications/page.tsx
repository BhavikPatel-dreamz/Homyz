import React from "react";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { notificationAdminService } from "@/services/notification-admin.service";
import { AdminNotificationsClient } from "./admin-notifications-client";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    channel?: string;
    search?: string;
    page?: string;
    limit?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}) {
  const actor = await requirePageRole([Role.ADMIN]);
  const sp = await searchParams;

  const [summary, notifsData] = await Promise.all([
    notificationAdminService.getNotificationSummaryForAdmin(actor),
    notificationAdminService.listNotificationsForAdmin(actor, {
      page: Number(sp.page) || 1,
      limit: Number(sp.limit) || 20,
      type: sp.type,
      channel: sp.channel,
      search: sp.search,
      status: sp.status,
      sortBy: (sp.sortBy as any) || "createdAt",
      sortOrder: (sp.sortOrder as any) || "desc",
    }),
  ]);

  return (
    <AdminNotificationsClient
      initialSummary={summary}
      initialNotifications={notifsData.notifications}
      initialPagination={notifsData.pagination}
    />
  );
}

