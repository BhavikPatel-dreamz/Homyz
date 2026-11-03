import { NextRequest } from "next/server";
import { z } from "zod";

import { created, ok } from "@/lib/api/response";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth, requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { Role, SupportCasePriority, SupportCaseStatus } from "@/generated/prisma/enums";
import { supportCaseService } from "@/services/support-case.service";

export const dynamic = "force-dynamic";

const createCaseSchema = z.object({
  bookingId: z.string().min(1).optional(),
  listingId: z.string().min(1).optional(),
  refundId: z.string().min(1).optional(),
  category: z.string().min(1).max(80),
  issueType: z.string().max(120).optional(),
  subject: z.string().min(1).max(160),
  description: z.string().max(10_000).optional(),
  priority: z.nativeEnum(SupportCasePriority).optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
  slaDueAt: z.coerce.date().optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: z.nativeEnum(SupportCaseStatus).optional(),
  priority: z.nativeEnum(SupportCasePriority).optional(),
  category: z.string().max(80).optional(),
  bookingId: z.string().min(1).optional(),
  listingId: z.string().min(1).optional(),
  assignedAdminId: z.string().min(1).optional(),
  search: z.string().max(160).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "slaDueAt", "priority"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  resolutionOnly: z.enum(["true"]).optional().transform(Boolean),
  slaState: z.enum(["BREACHED", "ON_TRACK"]).optional(),
});

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiAuth(req);
  if (actor.role === Role.ADMIN) {
    await requireApiPermission(req, PERMISSIONS.DISPUTES_VIEW);
  }
  const query = listQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return ok(await supportCaseService.listSupportCases(actor, query));
});

export const POST = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiAuth(req);
  if (actor.role === Role.ADMIN) {
    await requireApiPermission(req, PERMISSIONS.DISPUTES_MANAGE);
  }
  const input = createCaseSchema.parse(await req.json());
  return created(await supportCaseService.createSupportCase(actor, input));
});
