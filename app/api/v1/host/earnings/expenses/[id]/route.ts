import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OperatingExpenseCategory, Role } from "@/generated/prisma/enums";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { hostOperatingExpenseService } from "@/services/host-operating-expense.service";
import { requireHostDashboardFeature } from "@/lib/entitlements/host-dashboard";

const categories = Object.values(OperatingExpenseCategory) as [OperatingExpenseCategory, ...OperatingExpenseCategory[]];
const updateSchema = z.object({ listingId: z.string().min(1).optional(), bookingId: z.string().min(1).nullable().optional(), category: z.enum(categories).optional(), amountCents: z.number().int().positive().optional(), currency: z.string().trim().length(3).optional(), expenseDate: z.coerce.date().optional(), description: z.string().trim().max(2000).nullable().optional(), sourceReference: z.string().trim().max(200).nullable().optional() });
export const PATCH = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => { const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]); await requireHostDashboardFeature(actor, "OPERATIONS_AND_PROFITABILITY"); const { id } = await params; return NextResponse.json({ success: true, data: await hostOperatingExpenseService.update(actor, id, updateSchema.parse(await req.json())) }); });
export const DELETE = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => { const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]); await requireHostDashboardFeature(actor, "OPERATIONS_AND_PROFITABILITY"); const { id } = await params; const body = await req.json().catch(() => ({})); return NextResponse.json({ success: true, data: await hostOperatingExpenseService.void(actor, id, typeof body.reason === "string" ? body.reason : undefined) }); });
