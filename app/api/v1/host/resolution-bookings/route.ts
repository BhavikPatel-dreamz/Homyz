import { Role } from "@/generated/prisma/enums";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { requireApiRole } from "@/lib/permissions/guards";

export const dynamic = "force-dynamic";

/** Bookings a host may use when starting a direct resolution request. */
export const GET = apiHandler(async (req) => {
  const actor = await requireApiRole(req, [Role.HOST]);
  return ok(await prisma.booking.findMany({
    where: { listing: { hostId: actor.id } },
    select: { id: true, startDate: true, endDate: true, listing: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  }));
});
