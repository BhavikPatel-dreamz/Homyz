import React from "react";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { communicationAdminService } from "@/services/communication-admin.service";
import { AdminCommunicationsClient } from "./admin-communications-client";

export const dynamic = "force-dynamic";

export default async function AdminCommunicationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
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

  const [summary, conversationsData] = await Promise.all([
    communicationAdminService.getCommunicationSummaryForAdmin(actor),
    communicationAdminService.listBookingConversationsForAdmin(actor, {
      page: Number(sp.page) || 1,
      limit: Number(sp.limit) || 20,
      type: sp.type,
      search: sp.search,
      status: sp.status,
      sortBy: (sp.sortBy as any) || "lastMessageAt",
      sortOrder: (sp.sortOrder as any) || "desc",
    }),
  ]);

  return (
    <AdminCommunicationsClient
      initialSummary={summary}
      initialConversations={conversationsData.conversations}
      initialPagination={conversationsData.pagination}
    />
  );
}

