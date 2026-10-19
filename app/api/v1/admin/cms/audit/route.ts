import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";

// GET /api/v1/admin/cms/audit — List CMS audit history
export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.CMS_AUDIT_VIEW);

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "30", 10);
  const resourceId = searchParams.get("resourceId") || undefined;
  const action = searchParams.get("action") || undefined;

  const skip = (page - 1) * limit;

  const where: any = {
    resourceType: { in: ["CMS_CONTENT", "CMS_MEDIA", "CMS_SCHEDULE"] },
  };
  if (resourceId) where.resourceId = resourceId;
  if (action) where.action = action;

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return ok({
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

