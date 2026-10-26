import { Role } from "@/generated/prisma/enums";
import { cookies } from "next/headers";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { payoutService } from "@/services/payout.service";
import { HostTransactionsClient } from "../host-transactions-client";

export const dynamic = "force-dynamic";

const DATE_PRESETS = new Set([
  "all",
  "this_month",
  "last_month",
  "last_30_days",
  "next_30_days",
  "next_60_days",
  "next_90_days",
  "this_year",
  "custom",
]);
const PAGE_SIZES = new Set([10, 20, 25, 50]);
const PAYOUT_STATUSES = new Set([
  "SCHEDULED",
  "ELIGIBLE_SETTLEMENT",
  "PROCESSING",
  "PAID",
]);
const SORTS = new Set(["date_desc", "date_asc", "amount_desc", "amount_asc"]);

/** The standard host financial ledger: paid and payable reservations together. */
export default async function HostTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const params = await searchParams;
  const cookieStore = await cookies();
  const value = (key: string) =>
    Array.isArray(params[key]) ? params[key][0] : params[key];
  const displayCurrency =
    value("currency") ||
    cookieStore.get("homyz_display_currency")?.value ||
    "SAR";
  const candidatePreset = value("datePreset");
  const candidateLimit = Number(value("limit")) || 20;
  const payoutStatus = value("payoutStatus");
  const sort = value("sort");
  const initialData = await payoutService.listHostEarningsTransactions(
    actor.id,
    {
      kind: "all",
      page: Number(value("page")) || 1,
      limit: PAGE_SIZES.has(candidateLimit) ? candidateLimit : 20,
      listingId: value("propertyId"),
      search: value("search"),
      datePreset: DATE_PRESETS.has(candidatePreset || "")
        ? (candidatePreset as
            | "all"
            | "this_month"
            | "last_month"
            | "last_30_days"
            | "next_30_days"
            | "next_60_days"
            | "next_90_days"
            | "this_year"
            | "custom")
        : undefined,
      startDate: value("startDate"),
      endDate: value("endDate"),
      currency: displayCurrency,
      payoutStatus: PAYOUT_STATUSES.has(payoutStatus || "")
        ? (payoutStatus as
            | "SCHEDULED"
            | "ELIGIBLE_SETTLEMENT"
            | "PROCESSING"
            | "PAID")
        : undefined,
      sort: SORTS.has(sort || "")
        ? (sort as "date_desc" | "date_asc" | "amount_desc" | "amount_asc")
        : undefined,
      earningsType:
        value("earningsType") === "reservation" ? "reservation" : undefined,
    },
  );

  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] sm:pb-0">
      <HostHeader />
      <main className="flex-1 py-8 sm:py-10">
        <Container className="px-4 sm:px-6">
          <HostTransactionsClient
            kind="all"
            initialData={initialData}
            initialCurrency={displayCurrency}
          />
        </Container>
      </main>
    </div>
  );
}
