import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { prisma } from "@/lib/db/prisma";
import { Role } from "@/generated/prisma/enums";
import { AdminListingDetailClient } from "./admin-listing-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminListingDetailPage({ params }: PageProps) {
  await requirePageRole([Role.ADMIN]);
  const resolvedParams = await params;
  const listingId = resolvedParams.id;

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      host: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          phone: true,
          hostRegistrations: {
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: {
              status: true,
              complianceStatus: true,
              documents: {
                select: { id: true, documentType: true, fileUrl: true, status: true, rejectionReason: true },
                orderBy: { uploadedAt: "desc" },
              },
            },
          },
        },
      },
      _count: { select: { bookings: true } },
    },
  });

  if (!listing) {
    notFound();
  }

  let reviewer = null;
  if (listing.reviewerId) {
    reviewer = await prisma.user.findUnique({
      where: { id: listing.reviewerId },
      select: { id: true, name: true, email: true },
    });
  }

  let approvedBy = null;
  if (listing.approvedById) {
    approvedBy = await prisma.user.findUnique({
      where: { id: listing.approvedById },
      select: { id: true, name: true, email: true },
    });
  }

  const serializedListing = {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    price: listing.price,
    published: listing.published,
    status: listing.status,
    hostingType: listing.hostingType,
    propertyType: listing.propertyType || "Home",
    listingType: listing.listingType || "Entire place",
    address: listing.address || "",
    city: listing.city || "",
    district: listing.district || "",
    postalCode: listing.postalCode || "",
    country: listing.country || "",
    latitude: listing.latitude ?? null,
    longitude: listing.longitude ?? null,
    guests: listing.guests,
    bedrooms: listing.bedrooms,
    beds: listing.beds,
    bathrooms: listing.bathrooms,
    photos: listing.photos || [],
    amenities: listing.amenities || [],
    houseRules: listing.houseRules || [],
    highlights: listing.highlights || [],
    safetyDisclosures: listing.safetyDisclosures || [],
    checkInMethod: listing.checkInMethod || "SMART_LOCK",
    checkInStart: listing.checkInStart || "15:00",
    checkInEnd: listing.checkInEnd || "22:00",
    checkOutTime: listing.checkOutTime || "11:00",
    cancellationPolicy: listing.cancellationPolicy || "FLEXIBLE",
    instantBook: listing.instantBook ?? true,
    minNights: listing.minNights ?? 1,
    maxNights: listing.maxNights ?? 365,
    blockedDates: listing.blockedDates || [],
    cleaningFee: listing.cleaningFee ?? 0,
    securityDeposit: listing.securityDeposit ?? 0,
    weekendPrice: listing.weekendPrice ?? null,
    isPaused: listing.isPaused ?? false,
    isFeatured: listing.isFeatured ?? false,
    showExactLocation: listing.showExactLocation ?? true,
    rejectionReason: listing.rejectionReason || null,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
    approvedAt: listing.approvedAt ? listing.approvedAt.toISOString() : null,
    host: listing.host,
    hostVerification: listing.host.hostRegistrations[0]
      ? {
          status: listing.host.hostRegistrations[0].status,
          complianceStatus: listing.host.hostRegistrations[0].complianceStatus,
          documents: listing.host.hostRegistrations[0].documents,
        }
      : null,
    reviewer,
    approvedBy,
    bookingCount: listing._count.bookings,
    reviewCount: 0,
  };

  return <AdminListingDetailClient listing={serializedListing} />;
}
