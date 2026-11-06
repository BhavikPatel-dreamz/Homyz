import { NextRequest, NextResponse } from "next/server";
import { exchangeRateService } from "@/services/currency/exchange-rate.service";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/analytics/currency/rates
 * Returns exchange rates status or performs on-demand conversion.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireApiRole(req, [Role.ADMIN]);

    const { searchParams } = new URL(req.url);
    const amountStr = searchParams.get("amount");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const dateKey = searchParams.get("dateKey") || undefined;

    // Optional on-demand conversion
    if (amountStr && from && to) {
      const amountCents = parseInt(amountStr, 10);
      const conversion = await exchangeRateService.convertAmount({
        amountCents,
        fromCurrency: from,
        toCurrency: to,
        rateDateKey: dateKey,
      });
      return NextResponse.json({ success: true, data: conversion });
    }

    // Default: Return active rates status
    const status = await exchangeRateService.getRatesStatus();
    return NextResponse.json({ success: true, data: status });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || "Failed to retrieve exchange rates." },
      { status }
    );
  }
}

