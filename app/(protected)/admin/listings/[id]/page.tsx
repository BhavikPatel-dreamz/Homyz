import { notFound } from "next/navigation";
import { requirePagePermission, requirePageRole } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hasPermission } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";
import { Role } from "@/generated/prisma/enums";
import { HostListingEditorClient, type HostListingData } from "@/app/(protected)/host/listings/[id]/host-listing-editor-client";
import { slugToSection } from "@/app/(protected)/host/listings/[id]/section-helpers";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ section?: string }>;
}

export default async function AdminListingDetailPage({ params, searchParams }: PageProps) {
  const admin = await requirePageRole([Role.ADMIN]);
  await requirePagePermission(PERMISSIONS.LISTINGS_VIEW);
  const resolvedParams = await params;
  const listingId = resolvedParams.id;
  const initialSection = slugToSection((searchParams ? await searchParams : {}).section);

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
          createdAt: true,
          publicProfile: true,
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
      guidebookListings: {
        include: {
          guidebook: {
            include: {
              items: { orderBy: { sortOrder: "asc" } },
              listings: { include: { listing: { select: { id: true, title: true, city: true, photos: true } } } },
            },
          },
        },
      },
    },
  });

  if (!listing) {
    notFound();
  }

  const [auditLogs, auditLogTotal] = await Promise.all([prisma.auditLog.findMany({
    where: { resourceType: "Listing", resourceId: listing.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, action: true, description: true, actorEmail: true, createdAt: true },
  }), prisma.auditLog.count({ where: { resourceType: "Listing", resourceId: listing.id } })]);

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
    requestedChanges: listing.requestedChanges,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
    approvedAt: listing.approvedAt ? listing.approvedAt.toISOString() : null,
    host: {
      id: listing.host.id,
      name: listing.host.name,
      email: listing.host.email,
      image: listing.host.image,
      createdAt: listing.host.createdAt.toISOString(),
      publicProfile: (listing.host.publicProfile as Record<string, unknown> | null) ?? null,
    },
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

  return (
    <HostListingEditorClient
      listing={serializedListing as HostListingData}
      initialSection={initialSection}
      initialGuidebooks={listing.guidebookListings.map((link: typeof listing.guidebookListings[number]) => ({
        ...link.guidebook,
        createdAt: link.guidebook.createdAt.toISOString(),
        updatedAt: link.guidebook.updatedAt.toISOString(),
        listings: link.guidebook.listings.map((association: typeof link.guidebook.listings[number]) => ({
          id: association.listing.id,
          title: association.listing.title,
          city: association.listing.city,
          coverPhoto: association.listing.photos[0] ?? null,
        })),
      }))}
      routeBase="/admin/listings"
      presentation="admin"
      adminCapabilities={{
        canApprove: hasPermission(admin, PERMISSIONS.LISTINGS_APPROVE),
        canSuspend: hasPermission(admin, PERMISSIONS.LISTINGS_SUSPEND),
        canEdit: hasPermission(admin, PERMISSIONS.LISTINGS_EDIT),
      }}
      initialAuditLogs={auditLogs.map((item: typeof auditLogs[number]) => ({ ...item, createdAt: item.createdAt.toISOString() }))}
      initialAuditLogTotal={auditLogTotal}
    />
  );
}
