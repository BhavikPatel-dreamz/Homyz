import { requirePageRole } from "@/lib/permissions/page-guards";
import { prisma } from "@/lib/db/prisma";
import { Role } from "@/generated/prisma/enums";
import { AdminListingsClient } from "./admin-listings-client";

export default async function AdminListingsPage() {
  await requirePageRole([Role.ADMIN]);

  const [listings, totalCount, publishedCount, featuredCount, pausedCount] = await Promise.all([
    prisma.listing.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      include: {
        host: { select: { id: true, name: true, email: true, image: true } },
        _count: { select: { bookings: true } },
      },
    }),
    prisma.listing.count(),
    prisma.listing.count({ where: { published: true } }),
    prisma.listing.count({ where: { isFeatured: true } }),
    prisma.listing.count({ where: { isPaused: true } }),
  ]);

  const serializedListings = listings.map((l: any) => ({
    id: l.id,
    title: l.title,
    description: l.description,
    price: l.price,
    published: l.published,
    status: l.status,
    hostingType: l.hostingType,
    propertyType: l.propertyType || "Home",
    listingType: l.listingType || "Entire place",
    address: l.address || "",
    city: l.city || "",
    district: l.district || "",
    postalCode: l.postalCode || "",
    country: l.country || "",
    guests: l.guests,
    bedrooms: l.bedrooms,
    beds: l.beds,
    bathrooms: l.bathrooms,
    photos: l.photos || [],
    amenities: l.amenities || [],
    houseRules: l.houseRules || [],
    highlights: l.highlights || [],
    safetyDisclosures: l.safetyDisclosures || [],
    checkInMethod: l.checkInMethod || "SMART_LOCK",
    checkInStart: l.checkInStart || "15:00",
    checkInEnd: l.checkInEnd || "22:00",
    checkOutTime: l.checkOutTime || "11:00",
    cancellationPolicy: l.cancellationPolicy || "FLEXIBLE",
    instantBook: l.instantBook ?? true,
    minNights: l.minNights ?? 1,
    maxNights: l.maxNights ?? 365,
    blockedDates: l.blockedDates || [],
    cleaningFee: l.cleaningFee ?? 0,
    securityDeposit: l.securityDeposit ?? 0,
    weekendPrice: l.weekendPrice ?? null,
    isPaused: l.isPaused ?? false,
    isFeatured: l.isFeatured ?? false,
    showExactLocation: l.showExactLocation ?? true,
    rejectionReason: l.rejectionReason || null,
    createdAt: l.createdAt.toISOString(),
    host: l.host,
    bookingCount: l._count.bookings,
  }));

  return (
    <AdminListingsClient
      initialListings={serializedListings}
      summary={{
        total: totalCount,
        published: publishedCount,
        draft: totalCount - publishedCount,
        featured: featuredCount,
        paused: pausedCount,
      }}
    />
  );
}
