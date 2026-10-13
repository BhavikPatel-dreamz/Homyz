import React from "react";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { disputeService } from "@/services/dispute.service";
import { AdminDisputesClient } from "./admin-disputes-client";

export const dynamic = "force-dynamic";

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    search?: string;
    page?: string;
    limit?: string;
    category?: string;
    status?: string;
    severity?: string;
  }>;
}) {
  const actor = await requirePageRole([Role.ADMIN]);
  const sp = await searchParams;

  const [summary, disputesData] = await Promise.all([
    disputeService.getDisputeSummaryForAdmin(actor),
    disputeService.listDisputesForAdmin(actor, {
      page: Number(sp.page) || 1,
      limit: Number(sp.limit) || 20,
      tab: sp.tab,
      search: sp.search,
      category: sp.category,
      status: sp.status,
      severity: sp.severity,
    }),
  ]);

  return (
    <AdminDisputesClient
      initialSummary={summary}
      initialDisputes={disputesData.disputes}
      initialPagination={disputesData.pagination}
      initialTab={sp.tab || "all"}
      initialSearch={sp.search || ""}
    />
  );
}

