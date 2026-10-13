import React from "react";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { paymentAdminService } from "@/services/payment-admin.service";
import { AdminPayoutsClient } from "./admin-payouts-client";

export const dynamic = "force-dynamic";

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
    limit?: string;
  }>;
}) {
  const actor = await requirePageRole([Role.ADMIN]);
  const sp = await searchParams;

  const [summary, payoutsData] = await Promise.all([
    paymentAdminService.getPayoutSummaryForAdmin(actor),
    paymentAdminService.listHostPayoutsForAdmin(actor, {
      page: Number(sp.page) || 1,
      limit: Number(sp.limit) || 20,
      search: sp.search,
      status: sp.status,
      startDate: sp.startDate,
      endDate: sp.endDate,
    }),
  ]);

  return (
    <AdminPayoutsClient
      initialSummary={summary}
      initialPayouts={payoutsData.payouts}
      initialPagination={payoutsData.pagination}
      initialSearch={sp.search || ""}
    />
  );
}

