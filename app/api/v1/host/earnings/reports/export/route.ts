import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { AppError } from "@/lib/api/errors";
import { Role } from "@/generated/prisma/enums";
import {
  hostReportingService,
  type CustomReportQuery,
} from "@/services/host-reporting.service";

export const dynamic = "force-dynamic";

const reportPeriods = new Set<NonNullable<CustomReportQuery["period"]>>([
  "this_month",
  "last_month",
  "this_year",
  "previous_year",
  "custom",
]);
const earningsTypes = new Set<NonNullable<CustomReportQuery["earningsType"]>>([
  "all",
  "reservation",
  "adjustments",
]);
const reportPayoutStatuses = new Set<
  NonNullable<CustomReportQuery["payoutStatus"]>
>(["all", "paid", "upcoming"]);
const reportFieldKeys = new Set([
  "bookingId",
  "listingTitle",
  "guestName",
  "checkIn",
  "checkOut",
  "nights",
  "status",
  "currency",
  "accommodation",
  "cleaningFee",
  "extraGuestFee",
  "petFee",
  "grossEarnings",
  "hostServiceFee",
  "adjustments",
  "taxesWithheld",
  "netEarnings",
  "payoutReference",
  "payoutStatus",
  "payoutMethod",
  "scheduledPayoutDate",
  "actualPayoutDate",
  "payoutAmount",
]);

function optionalString(value: unknown, name: string): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string")
    throw AppError.badRequest(`${name} must be a string.`);
  return value;
}

function enumFilter<T extends string>(
  value: unknown,
  values: Set<T>,
  fallback: T,
  name: string,
): T {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string" || !values.has(value as T)) {
    throw AppError.badRequest(`Unsupported ${name} filter.`);
  }
  return value as T;
}

function normalizeQuery(
  raw: Record<string, unknown>,
  format: "csv" | "pdf",
): CustomReportQuery {
  const rawFields = raw.fields;
  if (
    rawFields != null &&
    (!Array.isArray(rawFields) ||
      rawFields.some((field) => typeof field !== "string"))
  ) {
    throw AppError.badRequest("Report fields must be a list of column keys.");
  }
  if (
    Array.isArray(rawFields) &&
    rawFields.some((field) => !reportFieldKeys.has(field))
  ) {
    throw AppError.badRequest("One or more report columns are not supported.");
  }
  return {
    period: enumFilter(raw.period, reportPeriods, "this_month", "period"),
    startDate: optionalString(raw.startDate, "startDate"),
    endDate: optionalString(raw.endDate, "endDate"),
    listingId: optionalString(raw.listingId ?? raw.propertyId, "listingId"),
    earningsType: enumFilter(
      raw.earningsType,
      earningsTypes,
      "all",
      "earnings type",
    ),
    payoutStatus: enumFilter(
      raw.payoutStatus,
      reportPayoutStatuses,
      "all",
      "payout status",
    ),
    payoutMethodMasked: optionalString(
      raw.payoutMethodMasked ?? raw.payoutMethod,
      "payoutMethod",
    ),
    currency: optionalString(raw.currency, "currency"),
    fields: rawFields as string[] | undefined,
    format,
  };
}

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const url = new URL(req.url);

  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "csv";
  const fields = url.searchParams
    .get("fields")
    ?.split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  const query = normalizeQuery(
    {
      period: url.searchParams.get("period"),
      startDate: url.searchParams.get("startDate"),
      endDate: url.searchParams.get("endDate"),
      propertyId: url.searchParams.get("propertyId"),
      listingId: url.searchParams.get("listingId"),
      earningsType: url.searchParams.get("earningsType"),
      payoutStatus: url.searchParams.get("payoutStatus"),
      payoutMethod: url.searchParams.get("payoutMethod"),
      currency: url.searchParams.get("currency"),
      fields,
    },
    format,
  );

  if (format === "pdf") {
    const { buffer, filename } = await hostReportingService.exportPdf(
      actor.id,
      query,
    );
    return new NextResponse(Uint8Array.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const { csv, filename } = await hostReportingService.exportCsv(
    actor.id,
    query,
  );
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const format = body.format === "pdf" ? "pdf" : "csv";
  const query = normalizeQuery(body, format);

  if (format === "pdf") {
    const { buffer, filename } = await hostReportingService.exportPdf(
      actor.id,
      query,
    );
    return new NextResponse(Uint8Array.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const { csv, filename } = await hostReportingService.exportCsv(
    actor.id,
    query,
  );
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
