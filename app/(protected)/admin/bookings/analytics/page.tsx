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

  // The summary is the first useful analytics view. The potentially expensive
  // performance tables load independently in the client with their own states.
  const overview = await analyticsAdminService.getBookingAnalyticsOverview(actor, {
    period: sp.period || "30d",
    currency: sp.currency,
  });

  return (
    <AdminAnalyticsClient
      initialOverview={overview}
      initialPeriod={sp.period || "30d"}
    />
  );
}
