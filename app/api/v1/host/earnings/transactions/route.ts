import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { AppError } from "@/lib/api/errors";
import { Role } from "@/generated/prisma/enums";
import {
  payoutService,
  type HostEarningsTransactionKind,
} from "@/services/payout.service";

const datePresets = new Set([
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
const transactionSorts = new Set([
  "date_desc",
  "date_asc",
  "amount_desc",
  "amount_asc",
]);
const payoutStatuses = new Set([
  "SCHEDULED",
  "ELIGIBLE_SETTLEMENT",
  "PROCESSING",
  "PAID",
]);

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (request: NextRequest) => {
  const actor = await requireApiRole(request, [Role.HOST, Role.ADMIN]);
  const url = new URL(request.url);
  const kind = url.searchParams.get("status");
  if (kind !== "all" && kind !== "upcoming" && kind !== "paid") {
    throw AppError.badRequest("A valid transaction status is required.");
  }
  const datePreset = url.searchParams.get("datePreset") || "all";
  const earningsType = url.searchParams.get("earningsType");
  const payoutStatus = url.searchParams.get("payoutStatus");
  const sort = url.searchParams.get("sort");
  if (payoutStatus && !payoutStatuses.has(payoutStatus)) {
    throw AppError.badRequest("Unsupported payout status filter.");
  }
  if (
    (kind === "upcoming" && payoutStatus === "PAID") ||
    (kind === "paid" && payoutStatus && payoutStatus !== "PAID")
  ) {
    throw AppError.badRequest(
      "Payout status is not valid for this transaction view.",
    );
  }
  const requestedLimit = Number(url.searchParams.get("limit")) || 20;
  if (![10, 20, 25, 50].includes(requestedLimit)) {
    throw AppError.badRequest("Unsupported transaction page size.");
  }
  if (sort && !transactionSorts.has(sort)) {
    throw AppError.badRequest("Unsupported transaction sort.");
  }
  const result = await payoutService.listHostEarningsTransactions(actor.id, {
    kind: kind as HostEarningsTransactionKind,
    page: Number(url.searchParams.get("page")) || 1,
    limit: requestedLimit,
    listingId:
      url.searchParams.get("propertyId") ||
      url.searchParams.get("listingId") ||
      undefined,
    search: url.searchParams.get("search") || undefined,
    datePreset: datePresets.has(datePreset)
      ? (datePreset as
          | "all"
          | "this_month"
          | "last_month"
          | "last_30_days"
          | "next_30_days"
          | "next_60_days"
          | "next_90_days"
          | "this_year"
          | "custom")
      : "all",
    startDate: url.searchParams.get("startDate") || undefined,
    endDate: url.searchParams.get("endDate") || undefined,
    currency: url.searchParams.get("currency") || undefined,
    payoutStatus: payoutStatus as
      "SCHEDULED" | "ELIGIBLE_SETTLEMENT" | "PROCESSING" | "PAID" | undefined,
    sort: sort as
      "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | undefined,
    earningsType: earningsType === "reservation" ? "reservation" : undefined,
  });
  return ok(result);
});
