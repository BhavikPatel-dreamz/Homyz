import React from "react";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { paymentAdminService } from "@/services/payment-admin.service";
import { AdminPaymentsClient } from "./admin-payments-client";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    search?: string;
    page?: string;
    limit?: string;
    status?: string;
    provider?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}) {
  const actor = await requirePageRole([Role.ADMIN]);
  const sp = await searchParams;

  const [summary, paymentsData] = await Promise.all([
    paymentAdminService.getPaymentSummaryForAdmin(actor),
    paymentAdminService.listPaymentsForAdmin(actor, {
      page: Number(sp.page) || 1,
      limit: Number(sp.limit) || 20,
      tab: sp.tab,
      search: sp.search,
      status: sp.status,
      provider: sp.provider,
      sortBy: (sp.sortBy as any) || "createdAt",
      sortOrder: (sp.sortOrder as any) || "desc",
    }),
  ]);

  return (
    <AdminPaymentsClient
      initialSummary={summary}
      initialPayments={paymentsData.payments}
      initialPagination={paymentsData.pagination}
      initialTab={sp.tab || "all"}
      initialSearch={sp.search || ""}
    />
  );
}

