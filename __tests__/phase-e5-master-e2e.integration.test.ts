import "dotenv/config";
import assert from "node:assert/strict";
import { Role, ListingStatus } from "../generated/prisma/enums";
import { prisma } from "../lib/db/prisma";
import { listingService } from "../services/listing.service";
import { toPublicListingDTO, toListingDTO } from "../services/mappers";
import { createListingSchema } from "../lib/validation/listing";

async function runMasterE2ETest() {
  if (process.env.RUN_DB_INTEGRATION_TESTS !== "1") {
    console.log("Skipped E5 master E2E integration test (set RUN_DB_INTEGRATION_TESTS=1 to run).");
    return;
  }

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const createdListingIds: string[] = [];
  const createdUserIds: string[] = [];

  try {
    const host = await prisma.user.create({
      data: {
        email: `e5-master-host-${suffix}@example.test`,
        name: "E5 Master Host",
        role: Role.USER,
      },
    });
    createdUserIds.push(host.id);
    const actor = { id: host.id, email: host.email, role: Role.USER };

    // STEP 1: CREATE LISTING via listingService.create (application path)
    const initialPhotos = [
      "/uploads/listing-photos/photo1.jpg",
      "/uploads/listing-photos/photo2.jpg",
      "/uploads/listing-photos/photo3.jpg",
      "/uploads/listing-photos/photo4.jpg",
      "/uploads/listing-photos/photo5.jpg",
    ];

    const created = await listingService.create(actor, createListingSchema.parse({
      title: "E5 Create Edit Public Integration Test",
      description: "E5 primary listing description with sufficient characters",
      price: 30000,
      weekendPrice: 35000,
      hostingType: "HOME",
      propertyType: "HOUSE",
      listingType: "ENTIRE_PLACE",
      address: "100 Olaya Street",
      city: "Riyadh",
      country: "Saudi Arabia",
      postalCode: "12211",
      latitude: 24.7136,
      longitude: 46.6753,
      showExactLocation: false,
      guests: 6,
      bedrooms: 3,
      beds: 4,
      bathrooms: 2,
      photos: initialPhotos,
      amenities: ["wifi", "kitchen", "air_conditioning", "smoke_alarm"],
      highlights: ["Peaceful", "Unique"],
      safetyDisclosures: ["SECURITY_CAMERA:NO", "NOISE_MONITOR:NO", "WEAPONS:NO"],
      discounts: { new_listing: true, weekly: true, monthly: true },
    }));
    createdListingIds.push(created.id);

    // STEP 2: DB INITIAL VERIFICATION
    assert.equal(created.title, "E5 Create Edit Public Integration Test");
    assert.equal(created.propertyType, "HOUSE");
    assert.equal(created.listingType, "ENTIRE_PLACE");
    assert.equal(created.guests, 6);
    assert.equal(created.bedrooms, 3);
    assert.equal(created.beds, 4);
    assert.equal(created.bathrooms, 2);
    assert.equal(created.price, 30000);
    assert.equal(created.weekendPrice, 35000);
    assert.equal(created.showExactLocation, false);
    assert.equal(created.published, false);
    assert.equal(created.status, ListingStatus.DRAFT);
    assert.equal(created.customSlug, null);
    assert.equal(created.photos.length, 5);

    // STEP 3: EDIT LOADER HYDRATION
    const loadedForEdit = await listingService.getForOwner(actor, created.id);
    assert.equal(loadedForEdit.id, created.id);
    assert.equal(loadedForEdit.title, created.title);
    assert.equal(loadedForEdit.guests, 6);
    assert.deepEqual(loadedForEdit.photos, initialPhotos);

    // STEP 4: EDIT & SAVE ALL EXTENDED FIELDS
    const customSlug = `e5-master-slug-${suffix}`;
    const updatedPhotos = [
      "/uploads/listing-photos/photo2.jpg",
      "/uploads/listing-photos/photo1.jpg",
      "/uploads/listing-photos/photo3.jpg",
      "/uploads/listing-photos/photo4.jpg",
      "/uploads/listing-photos/photo5.jpg",
    ];

    const updated = await listingService.update(actor, created.id, {
      title: "E5 Updated Integration Listing",
      guests: 8,
      description: "E5 updated description with full property details and extended text",
      descriptionSections: {
        property: "E5 property description",
        guestAccess: "E5 guest access",
        guestInteraction: "E5 interaction",
        otherDetails: "E5 details",
      },
      accessibilityFeatures: ["step_free_access"],
      locationFeatures: ["near_public_transport", "near_landmarks"],
      views: ["city_view"],
      neighborhoodDescription: "E5 neighborhood description",
      gettingAround: "E5 getting around details",
      photos: updatedPhotos,
      price: 32000,
      weekendPrice: 38000,
      instantBook: true,
      bookingMessage: "Please follow house rules before booking.",
      houseRules: ["Pets allowed", "No smoking"],
      petsAllowed: true,
      maxPets: 2,
      smokingAllowed: false,
      eventsAllowed: false,
      photographyAllowed: true,
      quietHours: true,
      quietHoursStart: "23:00",
      quietHoursEnd: "07:00",
      safetyEquipment: ["SMOKE_ALARM", "FIRE_EXTINGUISHER"],
      safetyHazards: ["Stairs"],
      cancellationPolicy: "MODERATE",
      longTermCancellationPolicy: "FIRM",
      customSlug: customSlug,
    });

    // STEP 5: REFRESH / REOPEN VERIFICATION (from real DB)
    const refreshed = await prisma.listing.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(refreshed.title, "E5 Updated Integration Listing");
    assert.equal(refreshed.guests, 8);
    assert.equal(refreshed.price, 32000);
    assert.equal(refreshed.weekendPrice, 38000);
    assert.equal(refreshed.customSlug, customSlug);
    assert.deepEqual(refreshed.photos, updatedPhotos);
    assert.deepEqual((refreshed.descriptionSections as any)?.property, "E5 property description");
    assert.deepEqual(refreshed.accessibilityFeatures, ["step_free_access"]);
    assert.deepEqual(refreshed.locationFeatures, ["near_public_transport", "near_landmarks"]);
    assert.deepEqual(refreshed.views, ["city_view"]);
    assert.equal(refreshed.neighborhoodDescription, "E5 neighborhood description");
    assert.equal(refreshed.gettingAround, "E5 getting around details");
    assert.equal(refreshed.petsAllowed, true);
    assert.equal(refreshed.maxPets, 2);
    assert.equal(refreshed.smokingAllowed, false);
    assert.equal(refreshed.eventsAllowed, false);
    assert.equal(refreshed.photographyAllowed, true);
    assert.equal(refreshed.quietHours, true);
    assert.equal(refreshed.quietHoursStart, "23:00");
    assert.equal(refreshed.quietHoursEnd, "07:00");
    assert.deepEqual(refreshed.safetyEquipment, ["SMOKE_ALARM", "FIRE_EXTINGUISHER"]);
    assert.deepEqual(refreshed.safetyHazards, ["Stairs"]);
    assert.equal(refreshed.cancellationPolicy, "MODERATE");
    assert.equal(refreshed.longTermCancellationPolicy, "FIRM");
    assert.equal(refreshed.bookingMessage, "Please follow house rules before booking.");

    // STEP 6: PARTIAL SAVE DATA-LOSS TEST
    // Saving only title must NOT wipe unrelated fields!
    await listingService.update(actor, created.id, { title: "E5 Title After Partial Save" });
    const afterPartialSave = await prisma.listing.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(afterPartialSave.title, "E5 Title After Partial Save");
    assert.equal(afterPartialSave.customSlug, customSlug, "customSlug preserved after partial save");
    assert.equal(afterPartialSave.guests, 8, "guests preserved after partial save");
    assert.deepEqual((afterPartialSave.descriptionSections as any)?.property, "E5 property description", "descriptionSections preserved");
    assert.deepEqual(afterPartialSave.accessibilityFeatures, ["step_free_access"], "accessibilityFeatures preserved");
    assert.deepEqual(afterPartialSave.locationFeatures, ["near_public_transport", "near_landmarks"], "locationFeatures preserved");
    assert.deepEqual(afterPartialSave.views, ["city_view"], "views preserved");
    assert.deepEqual(afterPartialSave.photos, updatedPhotos, "photos preserved");
    assert.equal(afterPartialSave.petsAllowed, true, "petsAllowed preserved");
    assert.equal(afterPartialSave.maxPets, 2, "maxPets preserved");
    assert.equal(afterPartialSave.photographyAllowed, true, "photographyAllowed preserved");
    assert.deepEqual(afterPartialSave.safetyEquipment, ["SMOKE_ALARM", "FIRE_EXTINGUISHER"], "safetyEquipment preserved");
    assert.equal(afterPartialSave.cancellationPolicy, "MODERATE", "cancellationPolicy preserved");

    // STEP 7: CENTRAL PUBLISH READINESS VALIDATOR
    const readiness = listingService.getPublishReadiness(afterPartialSave);
    assert.equal(readiness.publishable, true, "Fully completed listing must be publishable");
    assert.equal(readiness.missing.length, 0);

    // STEP 8: PUBLISH / ACTIVATE LISTING
    await prisma.listing.update({
      where: { id: created.id },
      data: { published: true, status: ListingStatus.ACTIVE },
    });

    // STEP 9: PUBLIC ID ROUTE RESOLUTION
    const publicById = await listingService.getPublicListingById(created.id);
    assert.equal(publicById.id, created.id);
    assert.equal(publicById.title, "E5 Title After Partial Save");
    assert.equal(publicById.customSlug, customSlug);
    assert.equal(publicById.guests, 8);
    assert.equal(publicById.price, 32000);
    assert.equal(publicById.weekendPrice, 38000);
    assert.deepEqual(publicById.photos, updatedPhotos);
    assert.deepEqual((publicById.descriptionSections as any)?.property, "E5 property description");
    assert.deepEqual(publicById.accessibilityFeatures, ["step_free_access"]);
    assert.deepEqual(publicById.locationFeatures, ["near_public_transport", "near_landmarks"]);
    assert.deepEqual(publicById.views, ["city_view"]);
    assert.equal(publicById.neighborhoodDescription, "E5 neighborhood description");
    assert.equal(publicById.gettingAround, "E5 getting around details");
    assert.equal(publicById.petsAllowed, true);
    assert.equal(publicById.maxPets, 2);
    assert.equal(publicById.photographyAllowed, true);
    assert.deepEqual(publicById.safetyEquipment, ["SMOKE_ALARM", "FIRE_EXTINGUISHER"]);
    assert.deepEqual(publicById.safetyHazards, ["Stairs"]);
    assert.equal(publicById.cancellationPolicy, "MODERATE");
    assert.equal(publicById.longTermCancellationPolicy, "FIRM");
    assert.equal(publicById.bookingMessage, "Please follow house rules before booking.");

    // Privacy checks on public output
    assert.equal(publicById.showExactLocation, false);
    assert.equal(publicById.address, null, "Hidden address must be null");
    assert.equal(publicById.postalCode, null, "Hidden postalCode must be null");
    assert.equal(publicById.latitude, 24.71, "Coordinates must be blurred/rounded");
    assert.equal(publicById.longitude, 46.68, "Coordinates must be blurred/rounded");
    assert.equal("wifiPassword" in publicById, false, "wifiPassword must not leak");
    assert.equal("doorCode" in publicById, false, "doorCode must not leak");
    assert.equal("lockboxCode" in publicById, false, "lockboxCode must not leak");
    assert.equal("houseManual" in publicById, false, "houseManual must not leak");

    // STEP 10: PUBLIC SLUG ROUTE RESOLUTION
    const publicBySlug = await listingService.getPublicListingBySlug(customSlug);
    assert.equal(publicBySlug.id, created.id);
    assert.equal(publicBySlug.title, publicById.title);
    assert.equal(publicBySlug.price, publicById.price);
    assert.equal(publicBySlug.customSlug, customSlug);
    assert.deepEqual(publicBySlug.photos, publicById.photos);
    assert.deepEqual(publicBySlug.descriptionSections, publicById.descriptionSections);

    console.log("E5 master Create -> DB -> Edit Load -> Edit -> Save -> DB -> Reopen -> Public ID -> Public Slug E2E passed.");
  } finally {
    if (createdListingIds.length > 0) {
      await prisma.booking.deleteMany({ where: { listingId: { in: createdListingIds } } });
      await prisma.listing.deleteMany({ where: { id: { in: createdListingIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  }
}

runMasterE2ETest().catch((err) => {
  console.error("E5 master E2E test failure:", err);
  process.exit(1);
});
