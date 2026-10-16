import React from "react";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { analyticsAdminService, type ReportType } from "@/services/analytics-admin.service";
import { AdminReportsClient } from "./admin-reports-client";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    startDate?: string;
    endDate?: string;
    currency?: string;
  }>;
}) {
  const actor = await requirePageRole([Role.ADMIN]);
  const sp = await searchParams;

  const reportType: ReportType = (sp.type as ReportType) || "BOOKING_REPORT";
  const reportData = await analyticsAdminService.generateReportData(actor, reportType, {
    startDate: sp.startDate,
    endDate: sp.endDate,
    currency: sp.currency,
    limit: 50,
  });

  return (
    <AdminReportsClient
      initialReportType={reportType}
      initialReport={reportData}
    />
  );
}

