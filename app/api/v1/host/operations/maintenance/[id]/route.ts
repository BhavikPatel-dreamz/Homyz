import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OperationalTaskStatus, Role } from "@/generated/prisma/enums";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { hostOperationalRecordsService } from "@/services/host-operational-records.service";
import { requireHostDashboardFeature } from "@/lib/entitlements/host-dashboard";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  status: z.enum(Object.values(OperationalTaskStatus) as [OperationalTaskStatus, ...OperationalTaskStatus[]]).optional(),
  serviceDate: z.coerce.date().nullable().optional(),
  nextServiceDate: z.coerce.date().nullable().optional(),
  equipmentReference: z.string().trim().max(200).nullable().optional(),
  usageReading: z.number().int().nonnegative().nullable().optional(),
  usageUnit: z.string().trim().max(50).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  actualExpenseCents: z.number().int().nonnegative().nullable().optional(),
});

export const dynamic = "force-dynamic";

export const PATCH = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  await requireHostDashboardFeature(actor, "OPERATIONS_AND_PROFITABILITY");
  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.parse(body);
  const data = await hostOperationalRecordsService.updateMaintenanceRecord(actor, id, parsed);
  return NextResponse.json({ success: true, data });
});

export const DELETE = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  await requireHostDashboardFeature(actor, "OPERATIONS_AND_PROFITABILITY");
  const { id } = await params;
  await hostOperationalRecordsService.deleteMaintenanceRecord(actor, id);
  return NextResponse.json({ success: true, message: "Maintenance record deleted successfully." });
});

