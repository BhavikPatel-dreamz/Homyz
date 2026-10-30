import { NextRequest } from "next/server";

import { Role, UserStatus } from "@/generated/prisma/enums";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  await requireApiPermission(req, PERMISSIONS.DISPUTES_VIEW);
  return ok(await prisma.user.findMany({
    where: { role: Role.ADMIN, status: UserStatus.ACTIVE },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: 200,
  }));
});
