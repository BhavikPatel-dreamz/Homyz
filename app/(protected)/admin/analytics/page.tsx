import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role, ListingStatus, UserStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { adminAnalyticsOverviewService } from "@/services/admin-analytics/overview.service";
import { revenueAnalyticsService } from "@/services/admin-analytics/revenue.service";
import { occupancyAnalyticsService } from "@/services/admin-analytics/occupancy.service";
import { operationsAnalyticsService } from "@/services/admin-analytics/operations.service";
import { AdminAnalyticsHubClient } from "@/components/admin/analytics/admin-analytics-hub-client";
import type { AnalyticsFilterInput } from "@/services/admin-analytics/analytics-contracts";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Analytics & Reports | Homyz Admin",
  description: "Executive marketplace reporting across revenue cash flow, hospitality occupancy, ADR/RevPAR, and support operations.",
};

export default async function AdminAnalyticsPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePageRole([Role.ADMIN]);

  const searchParams = props.searchParams ? await props.searchParams : {};
  const period = typeof searchParams.period === "string" ? searchParams.period : "30d";
  const startDate = typeof searchParams.startDate === "string" ? searchParams.startDate : undefined;
  const endDate = typeof searchParams.endDate === "string" ? searchParams.endDate : undefined;
  const comparisonMode = typeof searchParams.comparison === "string" ? (searchParams.comparison as any) : undefined;
  const listingId = typeof searchParams.listingId === "string" ? searchParams.listingId : undefined;
  const hostId = typeof searchParams.hostId === "string" ? searchParams.hostId : undefined;
  const city = typeof searchParams.city === "string" ? searchParams.city : undefined;
  const currency = typeof searchParams.currency === "string" ? searchParams.currency : undefined;
  const initialTab = typeof searchParams.tab === "string" ? (searchParams.tab as any) : "overview";

  const filterInput: AnalyticsFilterInput = {
    period: (period as any) || "30d",
    startDate,
    endDate,
    comparisonMode,
    listingId,
    hostId,
    city,
    currency,
  };

  const [
    overviewRes,
    revenueRes,
    occupancyRes,
    operationsRes,
    listings,
    hosts,
    cityRecords,
  ] = await Promise.all([
    adminAnalyticsOverviewService.getUnifiedOverview(filterInput),
    revenueAnalyticsService.getRevenueAnalytics(filterInput),
    occupancyAnalyticsService.getOccupancyAnalytics(filterInput),
    operationsAnalyticsService.getOperationsAnalytics(filterInput),
    prisma.listing.findMany({
      where: { status: ListingStatus.ACTIVE, deletedAt: null },
      select: { id: true, title: true, city: true, hostId: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.user.findMany({
      where: { role: Role.HOST, status: UserStatus.ACTIVE },
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.listing.findMany({
      where: { status: ListingStatus.ACTIVE, deletedAt: null, city: { not: null } },
      select: { city: true },
      distinct: ["city"],
    }),
  ]);

  const cities = cityRecords
    .map((c) => c.city)
    .filter((c): c is string => Boolean(c && c.trim()))
    .sort();

  const filterOptions = {
    listings,
    hosts,
    cities,
    currencies: ["SAR", "USD", "EUR"],
  };

  return (
    <AdminAnalyticsHubClient
      initialOverview={overviewRes}
      initialRevenue={revenueRes}
      initialOccupancy={occupancyRes}
      initialOperations={operationsRes}
      initialFilterOptions={filterOptions}
      initialTab={initialTab}
    />
  );
}
