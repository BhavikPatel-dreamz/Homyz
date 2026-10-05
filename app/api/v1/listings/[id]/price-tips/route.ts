import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { listingService } from "@/services/listing.service";
import { prisma } from "@/lib/db/prisma";
import { calculatePriceTips } from "@/lib/pricing/price-tips";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/listings/[id]/price-tips
 * Authenticated, data-driven Price Tips Recommendation API.
 * Aggregates listing properties, booking history, local calendar occupancy,
 * and internal comparable listings (when sample >= 3).
 *
 * Strictly adheres to Homyz data: zero fake competitor data, zero hardcoded multipliers.
 */
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { id } = await ctx.params;

  // Authorization: host must own the listing, or be an admin
  const listing = await listingService.getForOwner(actor, id);

  const body = await req.json().catch(() => ({}));
  let dateKeys: string[] = Array.isArray(body.dateKeys) ? body.dateKeys : [];

  // Default to next 30 days if no dateKeys were provided
  if (dateKeys.length === 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dateKeys = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + i));
      dateKeys.push(d.toISOString().slice(0, 10));
    }
  }

  // 1. Fetch real active bookings for this listing
  const bookings = await prisma.booking.findMany({
    where: {
      listingId: id,
      OR: [
        { status: "CONFIRMED" },
        { status: "COMPLETED" },
        { status: "PENDING" },
      ],
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      status: true,
      createdAt: true,
    },
    orderBy: { startDate: "asc" },
  });

  // 2. Fetch real internal comparable active listings in the same city and property type
  let comparables: { sampleCount: number; averagePrice: number } | null = null;
  if (listing.city && listing.propertyType) {
    const compListings = await prisma.listing.findMany({
      where: {
        id: { not: id },
        published: true,
        status: "ACTIVE",
        city: listing.city,
        propertyType: listing.propertyType,
        deletedAt: null,
      },
      select: {
        price: true,
        weekdayBasePrice: true,
      },
      take: 10,
    });

    // Strictly enforce minimum sample requirement: sample size must be at least 3
    if (compListings.length >= 3) {
      const sum = compListings.reduce(
        (acc: number, l: { price: number; weekdayBasePrice: number | null }) =>
          acc + (l.weekdayBasePrice ?? l.price),
        0,
      );
      comparables = {
        sampleCount: compListings.length,
        averagePrice: Math.round(sum / compListings.length),
      };
    }
  }

  // 3. Compute data-driven recommendations
  const result = calculatePriceTips({
    listing,
    dateKeys,
    bookings,
    comparables,
  });

  return ok(result);
});

/**
 * GET /api/v1/listings/[id]/price-tips
 * Convenience GET endpoint for single-range or default next 30 days query.
 */
export const GET = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { id } = await ctx.params;
  const listing = await listingService.getForOwner(actor, id);

  const datesParam = req.nextUrl.searchParams.get("dates");
  const dateKeys = datesParam
    ? datesParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const bookings = await prisma.booking.findMany({
    where: {
      listingId: id,
      OR: [
        { status: "CONFIRMED" },
        { status: "COMPLETED" },
        { status: "PENDING" },
      ],
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      status: true,
      createdAt: true,
    },
  });

  let comparables: { sampleCount: number; averagePrice: number } | null = null;
  if (listing.city && listing.propertyType) {
    const compListings = await prisma.listing.findMany({
      where: {
        id: { not: id },
        published: true,
        status: "ACTIVE",
        city: listing.city,
        propertyType: listing.propertyType,
        deletedAt: null,
      },
      select: {
        price: true,
        weekdayBasePrice: true,
      },
      take: 10,
    });

    if (compListings.length >= 3) {
      const sum = compListings.reduce(
        (acc: number, l: { price: number; weekdayBasePrice: number | null }) =>
          acc + (l.weekdayBasePrice ?? l.price),
        0,
      );
      comparables = {
        sampleCount: compListings.length,
        averagePrice: Math.round(sum / compListings.length),
      };
    }
  }

  const result = calculatePriceTips({
    listing,
    dateKeys: dateKeys.length > 0 ? dateKeys : undefined as any,
    bookings,
    comparables,
  });

  return ok(result);
});

