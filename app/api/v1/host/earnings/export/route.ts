import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { AppError } from "@/lib/api/errors";
import { Role } from "@/generated/prisma/enums";
import { payoutService } from "@/services/payout.service";
import { hostReportingService } from "@/services/host-reporting.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  const status = url.searchParams.get("status");
  if (format === "pdf") {
    const datePreset = url.searchParams.get("datePreset");
    const { buffer, filename } = await hostReportingService.exportPdf(
      actor.id,
      {
        period: [
          "this_month",
          "last_month",
          "this_year",
          "previous_year",
          "custom",
        ].includes(datePreset || "")
          ? (datePreset as
              | "this_month"
              | "last_month"
              | "this_year"
              | "previous_year"
              | "custom")
          : "this_month",
        startDate: url.searchParams.get("startDate") || undefined,
        endDate: url.searchParams.get("endDate") || undefined,
        listingId:
          url.searchParams.get("propertyId") ||
          url.searchParams.get("listingId") ||
          undefined,
        currency: url.searchParams.get("currency") || undefined,
        payoutStatus:
          status === "paid"
            ? "paid"
            : status === "upcoming"
              ? "upcoming"
              : "all",
      },
    );
    return new NextResponse(Uint8Array.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }
  if (status === "upcoming" || status === "paid") {
    const datePreset = url.searchParams.get("datePreset");
    const transactions = await payoutService.listHostEarningsTransactions(
      actor.id,
      {
        kind: status,
        // Export deliberately requests the full matching set; the list UI itself
        // remains paginated and bounded.
        limit: 50,
        includeAll: true,
        listingId:
          url.searchParams.get("propertyId") ||
          url.searchParams.get("listingId") ||
          undefined,
        search: url.searchParams.get("search") || undefined,
        datePreset: [
          "all",
          "this_month",
          "last_month",
          "last_30_days",
          "this_year",
          "custom",
        ].includes(datePreset || "")
          ? (datePreset as
              | "all"
              | "this_month"
              | "last_month"
              | "last_30_days"
              | "this_year"
              | "custom")
          : "all",
        startDate: url.searchParams.get("startDate") || undefined,
        endDate: url.searchParams.get("endDate") || undefined,
        currency: url.searchParams.get("currency") || undefined,
        payoutStatus: (() => {
          const value = url.searchParams.get("payoutStatus");
          if (!value) return undefined;
          if (
            ![
              "SCHEDULED",
              "ELIGIBLE_SETTLEMENT",
              "PROCESSING",
              "PAID",
            ].includes(value)
          ) {
            throw AppError.badRequest("Unsupported payout status filter.");
          }
          return value as
            "SCHEDULED" | "ELIGIBLE_SETTLEMENT" | "PROCESSING" | "PAID";
        })(),
        sort: (() => {
          const value = url.searchParams.get("sort");
          if (!value) return undefined;
          if (
            !["date_desc", "date_asc", "amount_desc", "amount_asc"].includes(
              value,
            )
          ) {
            throw AppError.badRequest("Unsupported transaction sort.");
          }
          return value as
            "date_desc" | "date_asc" | "amount_desc" | "amount_asc";
        })(),
      },
    );
    const cell = (value: unknown) => {
      const text = String(value ?? "");
      const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const headers = [
      "Booking Reference",
      "Property Title",
      "Guest Name",
      "Payout Date",
      "Gross Earnings",
      "Platform Fee",
      "Net Payout",
      "Currency",
      "Status",
    ];
    const rows = transactions.transactions.map((transaction) => [
      cell(transaction.bookingId),
      cell(transaction.listingTitle),
      cell(transaction.guestName),
      cell(
        status === "paid"
          ? transaction.executionDetails?.executedAt
          : transaction.scheduledPayoutDate,
      ),
      cell((transaction.grossEarnings / 100).toFixed(2)),
      cell((transaction.platformFee / 100).toFixed(2)),
      cell((transaction.netPayout / 100).toFixed(2)),
      cell(transaction.currency),
      cell(transaction.status),
    ]);
    return new NextResponse(
      [headers.join(","), ...rows.map((row) => row.join(","))].join("\n"),
      {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="Host_${status}_Transactions.csv"`,
        },
      },
    );
  }
  // Statements retain the established full-record export behavior. The normal
  // overview intentionally uses bounded payout previews for fast loading.
  const overview = await payoutService.getHostEarningsOverview(actor.id, {
    includeAllPayouts: true,
  });

  const headers = [
    "Booking Reference",
    "Property Title",
    "Guest Name",
    "Check-In",
    "Check-Out",
    "Scheduled Payout Date",
    "Gross Earnings",
    "Platform Fee",
    "Net Payout",
    "Currency",
    "Status",
  ];

  const allPayouts = [
    ...overview.upcomingPayouts,
    ...overview.completedPayouts,
  ];

  const rows = allPayouts.map((p) => [
    `"${p.bookingId}"`,
    `"${(p.listingTitle || "").replace(/"/g, '""')}"`,
    `"${p.guestName}"`,
    `"${new Date(p.startDate).toISOString().slice(0, 10)}"`,
    `"${new Date(p.endDate).toISOString().slice(0, 10)}"`,
    `"${new Date(p.scheduledPayoutDate).toISOString().slice(0, 10)}"`,
    `"${(p.grossEarnings / 100).toFixed(2)}"`,
    `"-${(p.platformFee / 100).toFixed(2)}"`,
    `"${(p.netPayout / 100).toFixed(2)}"`,
    `"${p.currency}"`,
    `"${p.status}"`,
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join(
    "\n",
  );
  const filename = `Host_Earnings_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
