import React from "react";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { refundService } from "@/services/refund.service";
import { AdminRefundsClient } from "./admin-refunds-client";

export const dynamic = "force-dynamic";

export default async function AdminBookingsRefundsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    tab?: string;
    search?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}) {
  const actor = await requirePageRole([Role.ADMIN]);
  const sp = searchParams ? await searchParams : undefined;

  const page = sp?.page ? parseInt(sp.page, 10) : 1;
  const limit = sp?.limit ? parseInt(sp.limit, 10) : 20;
  const tab = sp?.tab || "all";
  const search = sp?.search || undefined;
  const sortBy = sp?.sortBy as any;
  const sortOrder = sp?.sortOrder as any;

  const [summary, refundsData] = await Promise.all([
    refundService.getRefundSummaryForAdmin(actor),
    refundService.listRefundsForAdmin(actor, {
      page,
      limit,
      tab,
      search,
      sortBy,
      sortOrder,
    }),
  ]);

  return (
    <AdminRefundsClient
      initialSummary={summary}
      initialRefunds={refundsData.refunds}
      initialPagination={refundsData.pagination}
      initialTab={tab}
      initialSearch={search}
    />
  );
}
