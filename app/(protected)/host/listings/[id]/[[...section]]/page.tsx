import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { prisma } from "@/lib/db/prisma";
import { BookingStatus, Role } from "@/generated/prisma/enums";
import { HostListingEditorClient } from "../host-listing-editor-client";
import { guidebookService } from "@/services/guidebook.service";
import { slugToSection } from "../section-helpers";

interface PageProps {
  params: Promise<{ id: string; section?: string[] }>;
  searchParams?: Promise<{ section?: string }>;
}

export default async function HostListingEditorPage({ params, searchParams }: PageProps) {
  const actor = await requirePageRole([Role.USER, Role.HOST, Role.ADMIN]);
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const listingId = resolvedParams.id;

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      host: { select: { id: true, name: true, email: true, image: true, createdAt: true, publicProfile: true } },
      coHosts: {
        orderBy: { invitedAt: "desc" },
        include: { user: { select: { id: true, name: true, image: true } } },
      },
      bookings: {
        where: { status: BookingStatus.CONFIRMED },
        select: { id: true },
      },
    },
  });

  if (!listing || listing.deletedAt) {
    notFound();
  }

  const isAcceptedCoHost = listing.coHosts.some(
    (coHost: typeof listing.coHosts[number]) => coHost.status === "ACCEPTED" && coHost.userId === actor.id,
  );

  // Listing owners, accepted co-hosts, and admins can open the workspace.
  if (actor.role !== Role.ADMIN && listing.hostId !== actor.id && !isAcceptedCoHost) {
    notFound();
  }

  const rawSection = resolvedParams.section?.[0] || resolvedSearchParams.section;
  const initialSection = slugToSection(rawSection);

  const serializedListing = {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    descriptionSections: listing.descriptionSections ? JSON.parse(JSON.stringify(listing.descriptionSections)) : null,
    price: listing.price,
    smartPricing: listing.smartPricing ?? false,
    smartPricingMinPrice: listing.smartPricingMinPrice ?? null,
    smartPricingMaxPrice: listing.smartPricingMaxPrice ?? null,
    published: listing.published,
    status: listing.status,
    hostingType: listing.hostingType,
    placeCategory: listing.placeCategory ?? null,
    propertyType: listing.propertyType ?? "APARTMENT",
    listingType: listing.listingType ?? "ENTIRE_PLACE",
    locationSearch: listing.locationSearch ?? "",
    shortAddress: listing.shortAddress ?? "",
    address: listing.address ?? "",
    neighborhoodDescription: listing.neighborhoodDescription ?? null,
    gettingAround: listing.gettingAround ?? null,
    apartment: listing.apartment ?? "",
    city: listing.city ?? "",
    district: listing.district ?? "",
    postalCode: listing.postalCode ?? "",
    country: listing.country ?? "",
    latitude: listing.latitude ?? null,
    longitude: listing.longitude ?? null,
    showExactLocation: listing.showExactLocation ?? true,
    guests: listing.guests,
    bedrooms: listing.bedrooms,
    beds: listing.beds,
    bathrooms: listing.bathrooms,
    photos: listing.photos || [],
    languages: listing.languages || [],
    amenities: listing.amenities || [],
    highlights: listing.highlights || [],
    discounts: (listing.discounts as Record<string, unknown>) ?? {},
    houseRules: listing.houseRules || [],
    checkInMethod: listing.checkInMethod || "SMART_LOCK",
    checkInStart: listing.checkInStart || "15:00",
    checkInEnd: listing.checkInEnd || "22:00",
    checkOutTime: listing.checkOutTime || "11:00",
    cancellationPolicy: listing.cancellationPolicy || "FLEXIBLE",
    longTermCancellationPolicy: listing.longTermCancellationPolicy || "FIRM",
    bookingMessage: listing.bookingMessage ?? null,
    requireProfilePhoto: listing.requireProfilePhoto ?? false,
    requireGoodTrackRecord: listing.requireGoodTrackRecord ?? false,
    bookingApprovalMode: listing.bookingApprovalMode ?? (listing.instantBook ? "INSTANT" : "MANUAL"),
    approvedBookingCount: listing.bookings.length,
    instantBook: listing.instantBook ?? true,
    minNights: listing.minNights ?? 1,
    maxNights: listing.maxNights ?? 365,
    advanceNotice: listing.advanceNotice ?? "Same day",
    sameDayCutoff: listing.sameDayCutoff ?? "12:00 AM",
    allowSameDayRequests: listing.allowSameDayRequests ?? true,
    blockedDates: listing.blockedDates || [],
    cleaningFee: listing.cleaningFee ?? 0,
    securityDeposit: listing.securityDeposit ?? 0,
    weekendPrice: listing.weekendPrice ?? null,
    weekendPremium: listing.weekendPremium ?? null,
    isPaused: listing.isPaused ?? false,
    isFeatured: listing.isFeatured ?? false,
    customSlug: listing.customSlug ?? null,
    requestedChanges: listing.requestedChanges || null,
    rejectionReason: listing.rejectionReason || null,
    submittedAt: listing.submittedAt?.toISOString() ?? null,
    resubmittedAt: listing.resubmittedAt?.toISOString() ?? null,
    approvedAt: listing.approvedAt?.toISOString() ?? null,
    reapprovalRequired: listing.reapprovalRequired ?? false,
    reapprovalReason: listing.reapprovalReason ?? null,
    propertySize: listing.propertySize ?? null,
    propertySizeUnit: listing.propertySizeUnit ?? "SQM",
    listingFloor: listing.listingFloor ?? null,
    totalFloors: listing.totalFloors ?? null,
    yearBuilt: listing.yearBuilt ?? null,
    yearRenovated: listing.yearRenovated ?? null,
    privateEntrance: listing.privateEntrance ?? null,
    elevatorAvailable: listing.elevatorAvailable ?? null,
    stairsRequired: listing.stairsRequired ?? null,
    rooms: listing.rooms ?? null,
    fullBathrooms: listing.fullBathrooms ?? null,
    halfBathrooms: listing.halfBathrooms ?? null,
    privateBathrooms: listing.privateBathrooms ?? null,
    sharedBathrooms: listing.sharedBathrooms ?? null,
    parkingAvailable: listing.parkingAvailable ?? null,
    parkingType: listing.parkingType ?? null,
    parkingSpaces: listing.parkingSpaces ?? null,
    parkingReservation: listing.parkingReservation ?? null,
    guestAccess: listing.guestAccess || [],
    safetyDisclosures: listing.safetyDisclosures || [],
    safetyEquipment: listing.safetyEquipment || [],
    safetyHazards: listing.safetyHazards || [],
    accessibilityFeatures: listing.accessibilityFeatures || [],
    accessibilityDetails: listing.accessibilityDetails ? JSON.parse(JSON.stringify(listing.accessibilityDetails)) : [],
    views: listing.views || [],
    locationFeatures: listing.locationFeatures || [],
    petsAllowed: listing.petsAllowed ?? null,
    maxPets: listing.maxPets ?? null,
    petFee: listing.petFee ?? null,
    petRestrictions: listing.petRestrictions ?? null,
    dogsAllowed: listing.dogsAllowed ?? null,
    catsAllowed: listing.catsAllowed ?? null,
    smokingAllowed: listing.smokingAllowed ?? null,
    smokingLocation: listing.smokingLocation ?? null,
    eventsAllowed: listing.eventsAllowed ?? null,
    childrenAllowed: listing.childrenAllowed ?? null,
    infantsAllowed: listing.infantsAllowed ?? null,
    photographyAllowed: listing.photographyAllowed ?? null,
    quietHours: listing.quietHours ?? null,
    quietHoursStart: listing.quietHoursStart ?? null,
    quietHoursEnd: listing.quietHoursEnd ?? null,
    additionalRules: listing.additionalRules ?? null,
    directions: listing.directions ?? null,
    parkingInstructions: listing.parkingInstructions ?? null,
    checkInInstructions: listing.checkInInstructions ?? null,
    checkOutInstructions: listing.checkOutInstructions ?? null,
    houseManual: listing.houseManual ?? null,
    wifiNetwork: listing.wifiNetwork ?? null,
    wifiPassword: listing.wifiPassword ?? null,
    doorCode: listing.doorCode ?? null,
    lockboxCode: listing.lockboxCode ?? null,
    host: { ...listing.host, publicProfile: (listing.host.publicProfile as Record<string, unknown> | null) ?? null },
    coHosts: listing.coHosts.map((coHost: typeof listing.coHosts[number]) => ({
      id: coHost.id,
      email: coHost.email,
      phone: coHost.phone,
      status: coHost.status,
      invitedAt: coHost.invitedAt,
      expiresAt: coHost.expiresAt,
      acceptedAt: coHost.acceptedAt,
      user: coHost.user,
    })),
  };

  // Prefetch guidebooks associated with this listing to avoid an extra client fetch
  let initialGuidebooks: any[] = [];
  try {
    initialGuidebooks = await guidebookService.getGuidebooksForListing(listingId);
  } catch (err) {
    initialGuidebooks = [];
  }

  return (
    <HostListingEditorClient
      listing={serializedListing}
      initialSection={initialSection}
      initialGuidebooks={initialGuidebooks}
    />
  );
}

