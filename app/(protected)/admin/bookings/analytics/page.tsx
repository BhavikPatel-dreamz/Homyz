import React from "react";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { analyticsAdminService } from "@/services/analytics-admin.service";
import { AdminAnalyticsClient } from "./admin-analytics-client";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: "today" | "7d" | "30d" | "this_month" | "last_month" | "90d" | "this_year" | "custom";
    currency?: string;
  }>;
}) {
  const actor = await requirePageRole([Role.ADMIN]);
  const sp = await searchParams;

  const [overview, propertiesData, hostsData] = await Promise.all([
    analyticsAdminService.getBookingAnalyticsOverview(actor, {
      period: sp.period || "30d",
      currency: sp.currency,
    }),
    analyticsAdminService.getPropertyPerformanceAnalytics(actor, { limit: 20 }),
    analyticsAdminService.getHostPerformanceAnalytics(actor, { limit: 20 }),
  ]);

  return (
    <AdminAnalyticsClient
      initialOverview={overview}
      initialProperties={propertiesData.properties}
      initialHosts={hostsData.hosts}
      initialPeriod={sp.period || "30d"}
    />
  );
}

