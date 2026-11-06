import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role, ListingStatus, UserStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export interface FilterOptionsResponse {
  listings: Array<{ id: string; title: string; city: string | null; hostId: string }>;
  hosts: Array<{ id: string; name: string | null; email: string }>;
  cities: string[];
  currencies: string[];
}

export const GET = apiHandler(async (req: NextRequest) => {
  await requireApiRole(req, [Role.ADMIN]);

  const [listings, hosts, cityRecords] = await Promise.all([
    prisma.listing.findMany({
      where: {
        status: ListingStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        city: true,
        hostId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.user.findMany({
      where: {
        role: Role.HOST,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.listing.findMany({
      where: {
        status: ListingStatus.ACTIVE,
        deletedAt: null,
        city: { not: null },
      },
      select: { city: true },
      distinct: ["city"],
    }),
  ]);

  const cities = cityRecords
    .map((c) => c.city)
    .filter((c): c is string => Boolean(c && c.trim()))
    .sort();

  const data: FilterOptionsResponse = {
    listings,
    hosts,
    cities,
    currencies: ["SAR", "USD", "EUR"],
  };

  return ok(data);
});

