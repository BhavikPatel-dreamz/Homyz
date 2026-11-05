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
  scheduledFor: z.coerce.date().nullable().optional(),
  actualExpenseCents: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const dynamic = "force-dynamic";

export const PATCH = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  await requireHostDashboardFeature(actor, "OPERATIONS_AND_PROFITABILITY");
  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.parse(body);
  const data = await hostOperationalRecordsService.updateCleaningTask(actor, id, parsed);
  return NextResponse.json({ success: true, data });
});

export const DELETE = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  await requireHostDashboardFeature(actor, "OPERATIONS_AND_PROFITABILITY");
  const { id } = await params;
  await hostOperationalRecordsService.deleteCleaningTask(actor, id);
  return NextResponse.json({ success: true, message: "Cleaning task deleted successfully." });
});
