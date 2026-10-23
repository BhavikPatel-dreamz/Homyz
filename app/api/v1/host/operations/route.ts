import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@/generated/prisma/enums";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { hostOperationalRecordsService } from "@/services/host-operational-records.service";
import { requireHostDashboardFeature } from "@/lib/entitlements/host-dashboard";

const taskSchema = z.object({ listingId: z.string().min(1), bookingId: z.string().min(1).nullable().optional(), title: z.string().trim().min(1).max(200), scheduledFor: z.coerce.date().nullable().optional(), notes: z.string().trim().max(2000).nullable().optional(), actualExpenseCents: z.number().int().nonnegative().nullable().optional(), currency: z.string().length(3).optional(), idempotencyKey: z.string().min(8).max(200).nullable().optional() });
const maintenanceSchema = z.object({ listingId: z.string().min(1), title: z.string().trim().min(1).max(200), serviceDate: z.coerce.date().nullable().optional(), nextServiceDate: z.coerce.date().nullable().optional(), equipmentReference: z.string().trim().max(200).nullable().optional(), usageReading: z.number().int().nonnegative().nullable().optional(), usageUnit: z.string().trim().max(50).nullable().optional(), notes: z.string().trim().max(2000).nullable().optional(), actualExpenseCents: z.number().int().nonnegative().nullable().optional(), currency: z.string().length(3).optional() });
export const dynamic = "force-dynamic";
export const GET = apiHandler(async (req: NextRequest) => { const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]); await requireHostDashboardFeature(actor, "OPERATIONS_AND_PROFITABILITY"); return NextResponse.json({ success: true, data: await hostOperationalRecordsService.overview(actor, req.nextUrl.searchParams.get("listingId") || undefined) }, { headers: { "Cache-Control": "private, no-store" } }); });
export const POST = apiHandler(async (req: NextRequest) => { const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]); await requireHostDashboardFeature(actor, "OPERATIONS_AND_PROFITABILITY"); const body = await req.json(); if (body.type === "MAINTENANCE") return NextResponse.json({ success: true, data: await hostOperationalRecordsService.createMaintenanceRecord(actor, maintenanceSchema.parse(body)) }, { status: 201 }); return NextResponse.json({ success: true, data: await hostOperationalRecordsService.createCleaningTask(actor, taskSchema.parse(body)) }, { status: 201}); });
