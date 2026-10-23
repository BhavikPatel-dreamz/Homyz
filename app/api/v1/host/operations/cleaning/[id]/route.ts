import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OperationalTaskStatus, Role } from "@/generated/prisma/enums";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { hostOperationalRecordsService } from "@/services/host-operational-records.service";
const schema = z.object({ status: z.enum(Object.values(OperationalTaskStatus) as [OperationalTaskStatus, ...OperationalTaskStatus[]]) });
export const PATCH = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => { const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]); const { id } = await params; return NextResponse.json({ success: true, data: await hostOperationalRecordsService.updateCleaningStatus(actor, id, schema.parse(await req.json()).status) }); });
