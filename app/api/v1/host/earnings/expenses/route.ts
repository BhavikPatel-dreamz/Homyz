import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OperatingExpenseCategory, Role } from "@/generated/prisma/enums";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { hostOperatingExpenseService } from "@/services/host-operating-expense.service";
import { requireHostDashboardFeature } from "@/lib/entitlements/host-dashboard";

const categories = Object.values(OperatingExpenseCategory) as [OperatingExpenseCategory, ...OperatingExpenseCategory[]];
const date = z.coerce.date();
const createSchema = z.object({ listingId: z.string().min(1), bookingId: z.string().min(1).nullable().optional(), category: z.enum(categories), amountCents: z.number().int().positive(), currency: z.string().trim().length(3), expenseDate: date, description: z.string().trim().max(2000).nullable().optional(), sourceReference: z.string().trim().max(200).nullable().optional(), idempotencyKey: z.string().min(8).max(200).nullable().optional() });

export const dynamic = "force-dynamic";
export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  await requireHostDashboardFeature(actor, "OPERATIONS_AND_PROFITABILITY");
  const params = req.nextUrl.searchParams;
  const category = params.get("category");
  return NextResponse.json({ success: true, data: await hostOperatingExpenseService.list(actor, { listingId: params.get("listingId") || undefined, category: category && categories.includes(category as OperatingExpenseCategory) ? category as OperatingExpenseCategory : undefined, startDate: params.get("startDate") ? date.parse(params.get("startDate")) : undefined, endDate: params.get("endDate") ? date.parse(params.get("endDate")) : undefined, skip: Math.max(0, Number(params.get("skip") || 0)), take: Math.min(100, Math.max(1, Number(params.get("take") || 50))) }) });
});
export const POST = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  await requireHostDashboardFeature(actor, "OPERATIONS_AND_PROFITABILITY");
  return NextResponse.json({ success: true, data: await hostOperatingExpenseService.create(actor, createSchema.parse(await req.json())) }, { status: 201 });
});
