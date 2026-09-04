import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { prisma } from "@/lib/db/prisma";
import { Role } from "@/generated/prisma/enums";
import { HostListingEditorClient } from "../host-listing-editor-client";
import { slugToSection } from "../section-helpers";

interface PageProps {
  params: Promise<{ id: string; section?: string[] }>;
  searchParams?: Promise<{ section?: string }>;
}

export default async function HostListingEditorPage({ params, searchParams }: PageProps) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const listingId = resolvedParams.id;

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      host: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  if (!listing) {
    notFound();
  }

  // Security check: Ensure host owns listing unless admin
  if (actor.role !== Role.ADMIN && listing.hostId !== actor.id) {
    notFound();
  }

  const rawSection = resolvedParams.section?.[0] || resolvedSearchParams.section;
  const initialSection = slugToSection(rawSection);

  const serializedListing = {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    price: listing.price,
    published: listing.published,
    status: listing.status,
    hostingType: listing.hostingType,
    propertyType: listing.propertyType || "Apartment",
    listingType: listing.listingType || "Entire place",
    address: listing.address || "",
    city: listing.city || "",
    district: listing.district || "",
    postalCode: listing.postalCode || "",
    country: listing.country || "",
    guests: listing.guests,
    bedrooms: listing.bedrooms,
    beds: listing.beds,
    bathrooms: listing.bathrooms,
    photos: listing.photos || [],
    amenities: listing.amenities || [],
    houseRules: listing.houseRules || [],
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
    requestedChanges: listing.requestedChanges || null,
    rejectionReason: listing.rejectionReason || null,
    host: listing.host,
  };

  return <HostListingEditorClient listing={serializedListing} initialSection={initialSection} />;
}
