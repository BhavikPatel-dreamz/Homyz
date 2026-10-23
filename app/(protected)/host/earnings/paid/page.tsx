import { Role } from "@/generated/prisma/enums";
import { cookies } from "next/headers";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { payoutService } from "@/services/payout.service";
import { HostTransactionsClient } from "../host-transactions-client";

export const dynamic = "force-dynamic";

export default async function PaidTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const params = await searchParams;
  const cookieStore = await cookies();
  const value = (key: string) =>
    Array.isArray(params[key]) ? params[key][0] : params[key];
  const displayCurrency = value("currency") || cookieStore.get("homyz_display_currency")?.value || "SAR";
  const candidatePreset = value("datePreset");
  const datePreset = [
    "all",
    "this_month",
    "last_month",
    "last_30_days",
    "next_30_days",
    "next_60_days",
    "next_90_days",
    "this_year",
    "custom",
  ].includes(candidatePreset || "")
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
    : undefined;
  const payoutStatus = value("payoutStatus") === "PAID" ? "PAID" : undefined;
  const sort = ["date_desc", "date_asc", "amount_desc", "amount_asc"].includes(
    value("sort") || "",
  )
    ? (value("sort") as "date_desc" | "date_asc" | "amount_desc" | "amount_asc")
    : undefined;
  const initialData = await payoutService.listHostEarningsTransactions(
    actor.id,
    {
      kind: "paid",
      page: Number(value("page")) || 1,
      listingId: value("propertyId"),
      search: value("search"),
      datePreset,
      startDate: value("startDate"),
      endDate: value("endDate"),
      currency: displayCurrency,
      payoutStatus,
      sort,
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
            kind="paid"
            initialData={initialData}
            initialCurrency={displayCurrency}
          />
        </Container>
      </main>
    </div>
  );
}
