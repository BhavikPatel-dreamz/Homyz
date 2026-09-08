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
  const actor = await requirePageRole([Role.USER, Role.HOST, Role.ADMIN]);
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
    // Professional property details
    propertySize: listing.propertySize ?? null,
    propertySizeUnit: listing.propertySizeUnit ?? "SQM",
    listingFloor: listing.listingFloor ?? null,
    totalFloors: listing.totalFloors ?? null,
    yearBuilt: listing.yearBuilt ?? null,
    yearRenovated: listing.yearRenovated ?? null,
    privateEntrance: listing.privateEntrance ?? null,
    elevatorAvailable: listing.elevatorAvailable ?? null,
    stairsRequired: listing.stairsRequired ?? null,
    rooms: (listing.rooms as any) || null,
    fullBathrooms: listing.fullBathrooms ?? null,
    halfBathrooms: listing.halfBathrooms ?? null,
    privateBathrooms: listing.privateBathrooms ?? null,
    sharedBathrooms: listing.sharedBathrooms ?? null,
    parkingAvailable: listing.parkingAvailable ?? null,
    parkingType: listing.parkingType ?? null,
    parkingSpaces: listing.parkingSpaces ?? null,
    parkingReservation: listing.parkingReservation ?? null,
    guestAccess: listing.guestAccess || [],
    safetyEquipment: listing.safetyEquipment || [],
    safetyHazards: listing.safetyHazards || [],
    accessibilityFeatures: listing.accessibilityFeatures || [],
    views: listing.views || [],
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
    houseManual: listing.houseManual ?? null,
    wifiNetwork: listing.wifiNetwork ?? null,
    wifiPassword: listing.wifiPassword ?? null,
    doorCode: listing.doorCode ?? null,
    lockboxCode: listing.lockboxCode ?? null,
    host: listing.host,
  };

  return <HostListingEditorClient listing={serializedListing} initialSection={initialSection} />;
}
