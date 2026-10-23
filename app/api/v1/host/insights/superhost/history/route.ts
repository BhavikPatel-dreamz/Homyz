import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { getSuperhostAssessmentHistory } from "@/services/superhost.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const evaluations = await getSuperhostAssessmentHistory(actor.id);
  return NextResponse.json({ success: true, data: { evaluations } });
});
