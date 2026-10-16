import "dotenv/config";
import assert from "node:assert/strict";
import { Role, ListingStatus } from "../generated/prisma/enums";
import { prisma } from "../lib/db/prisma";
import { listingService } from "../services/listing.service";
import { toPublicListingDTO } from "../services/mappers";
import { createListingSchema } from "../lib/validation/listing";
import { normalizeAmenities, getAmenityMeta } from "../lib/constants/amenities";

async function runPhaseE6ProductionQATest() {
  if (process.env.RUN_DB_INTEGRATION_TESTS !== "1") {
    console.log("Skipped E6 production QA integration test (set RUN_DB_INTEGRATION_TESTS=1 to run).");
    return;
  }

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const createdListingIds: string[] = [];
  const createdUserIds: string[] = [];

  try {
    // Create Host User
    const host = await prisma.user.create({
      data: {
        email: `e6-prod-host-${suffix}@example.test`,
        name: "E6 Production Host",
        role: Role.HOST,
      },
    });
    createdUserIds.push(host.id);
    const hostActor = { id: host.id, email: host.email, role: Role.HOST };

    // Create Rogue User (for authorization checks)
    const rogueUser = await prisma.user.create({
      data: {
        email: `e6-rogue-user-${suffix}@example.test`,
        name: "E6 Rogue User",
        role: Role.USER,
      },
    });
    createdUserIds.push(rogueUser.id);
    const rogueActor = { id: rogueUser.id, email: rogueUser.email, role: Role.USER };

    // ─────────────────────────────────────────────────────────────────
    // 1. CREATE INITIAL DRAFT LISTING
    // ─────────────────────────────────────────────────────────────────
    console.log("▶ 1. Testing Create Draft Listing...");
    const draftListing = await listingService.create(hostActor, createListingSchema.parse({
      title: "E6 Production Grand Residence",
      description: "A luxury spacious residence designed for full production QA testing",
      price: 45000,
      weekendPrice: 52000,
      hostingType: "HOME",
      propertyType: "HOUSE",
      listingType: "ENTIRE_PLACE",
      address: "500 King Fahd Road",
      city: "Riyadh",
      country: "Saudi Arabia",
      postalCode: "11564",
      latitude: 24.7200,
      longitude: 46.6800,
      showExactLocation: true,
      guests: 8,
      bedrooms: 4,
      beds: 5,
      bathrooms: 3,
      photos: [
        "/uploads/listing-photos/p1.jpg",
        "/uploads/listing-photos/p2.jpg",
        "/uploads/listing-photos/p3.jpg",
        "/uploads/listing-photos/p4.jpg",
        "/uploads/listing-photos/p5.jpg",
      ],
      amenities: ["wifi", "tv", "kitchen"],
      highlights: ["Luxury", "Spacious"],
      safetyDisclosures: ["SECURITY_CAMERA:NO", "NOISE_MONITOR:NO", "WEAPONS:NO"],
    }));
    createdListingIds.push(draftListing.id);

    assert.equal(draftListing.status, ListingStatus.DRAFT);
    assert.equal(draftListing.published, false);
    console.log("✔ Draft listing created successfully with status DRAFT, published=false");

    // ─────────────────────────────────────────────────────────────────
    // 2. AMENITIES FULL ROUND-TRIP: ADD, REPLACE, NORMALIZE & PERSIST
    // ─────────────────────────────────────────────────────────────────
    console.log("▶ 2. Testing Amenities Round-Trip (Add, Replace, Normalize, Meta)...");
    const mixedAmenitiesInput = [
      "Wifi",
      "Air conditioning",
      "hot_tub",
      "Swimming Pool",
      "kitchen",
      "smoke_alarm",
      "free_parking",
    ];

    const updatedWithAmenities = await listingService.update(hostActor, draftListing.id, {
      amenities: mixedAmenitiesInput,
    });

    const expectedCanonical = [
      "wifi",
      "air_conditioning",
      "hot_tub",
      "pool",
      "kitchen",
      "smoke_alarm",
      "free_parking",
    ];

    assert.deepEqual(
      normalizeAmenities(updatedWithAmenities.amenities).sort(),
      expectedCanonical.sort()
    );

    // Verify metadata lookup for all amenities
    for (const amId of updatedWithAmenities.amenities) {
      const meta = getAmenityMeta(amId);
      assert.ok(meta.label.length > 0, `Missing label for amenity ${amId}`);
      assert.ok(meta.icon, `Missing icon for amenity ${amId}`);
    }

    // Test removing amenities and replacing
    const reducedAmenities = ["wifi", "kitchen", "air_conditioning"];
    const afterRemoval = await listingService.update(hostActor, draftListing.id, {
      amenities: reducedAmenities,
    });
    assert.equal(afterRemoval.amenities.length, 3);
    assert.deepEqual(afterRemoval.amenities.sort(), reducedAmenities.sort());
    console.log("✔ Amenities add, replace, normalize, and metadata verified successfully");

    // ─────────────────────────────────────────────────────────────────
    // 3. PUBLISH READINESS VALIDATION GATE
    // ─────────────────────────────────────────────────────────────────
    console.log("▶ 3. Testing Publish Readiness Gate on Incomplete Listing...");
    // Create an incomplete listing (0 photos, missing weekendPrice)
    const incompleteListing = await prisma.listing.create({
      data: {
        hostId: host.id,
        title: "Incomplete Test",
        description: "Short",
        price: 10000,
        weekendPrice: null, // missing
        propertyType: "APARTMENT",
        listingType: "ENTIRE_PLACE",
        status: ListingStatus.DRAFT,
        published: false,
        photos: [], // missing (needs >= 5)
        safetyDisclosures: [], // missing
      },
    });
    createdListingIds.push(incompleteListing.id);

    let blockedError: any = null;
    try {
      await listingService.publish(hostActor, incompleteListing.id);
    } catch (err: any) {
      blockedError = err;
    }
    assert.ok(blockedError, "Direct publish of incomplete listing must be blocked");
    assert.equal(blockedError.status, 400);
    assert.ok(blockedError.message.includes("Cannot publish listing"));
    console.log("✔ Incomplete draft correctly blocked with 400 Bad Request");

    // ─────────────────────────────────────────────────────────────────
    // 4. DIRECT HOST PUBLISHING WITHOUT ADMIN APPROVAL
    // ─────────────────────────────────────────────────────────────────
    console.log("▶ 4. Testing Direct Host Publishing Without Admin Approval...");
    const readiness = listingService.getPublishReadiness(afterRemoval as any);
    assert.equal(readiness.publishable, true, `Listing should be publishable. Missing: ${readiness.missing.join(", ")}`);

    const published = await listingService.publish(hostActor, draftListing.id);
    assert.equal(published.published, true);
    assert.equal(published.status, ListingStatus.ACTIVE);
    assert.equal(published.isPaused, false);

    // Verify in database directly
    const dbPublished = await prisma.listing.findUnique({ where: { id: draftListing.id } });
    assert.equal(dbPublished?.published, true);
    assert.equal(dbPublished?.status, ListingStatus.ACTIVE);
    console.log("✔ Direct host publishing verified: DRAFT -> ACTIVE/PUBLISHED without admin review");

    // ─────────────────────────────────────────────────────────────────
    // 5. DIRECT HOST UNPUBLISHING & RE-PUBLISHING
    // ─────────────────────────────────────────────────────────────────
    console.log("▶ 5. Testing Direct Host Unpublishing and Re-publishing...");
    const unpublished = await listingService.unpublish(hostActor, draftListing.id);
    assert.equal(unpublished.published, false);
    assert.equal(unpublished.status, ListingStatus.DRAFT);

    // Public guest must not find unpublished listing (throws 404 NOT_FOUND)
    let publicUnpublishedBlocked = false;
    try {
      await listingService.getPublicListingById(draftListing.id);
    } catch (err: any) {
      if (err.status === 404 || err.code === "NOT_FOUND") {
        publicUnpublishedBlocked = true;
      }
    }
    assert.ok(publicUnpublishedBlocked, "Unpublished listing must be hidden with 404 from public queries");

    // Re-publish back to ACTIVE
    const rePublished = await listingService.publish(hostActor, draftListing.id);
    assert.equal(rePublished.published, true);
    assert.equal(rePublished.status, ListingStatus.ACTIVE);

    const publicFetchRePublished = await listingService.getPublicListingById(draftListing.id);
    assert.ok(publicFetchRePublished, "Re-published listing must be publicly accessible");
    console.log("✔ Unpublishing and re-publishing lifecycle verified successfully");

    // ─────────────────────────────────────────────────────────────────
    // 6. CUSTOM SLUG & PUBLIC ROUTING & PRIVACY CHECK
    // ─────────────────────────────────────────────────────────────────
    console.log("▶ 6. Testing Custom Slug, Public Slug Routing & Privacy...");
    const testSlug = `e6-prod-luxury-suite-${suffix}`;
    const withSlug = await listingService.update(hostActor, draftListing.id, {
      customSlug: testSlug,
    });
    assert.equal(withSlug.customSlug, testSlug);

    const publicBySlug = await listingService.getPublicListingBySlug(testSlug);
    assert.ok(publicBySlug, "Must resolve listing via public slug route");
    assert.equal(publicBySlug?.id, draftListing.id);
    assert.equal(publicBySlug?.title, "E6 Production Grand Residence");

    // Verify Public DTO Privacy
    const publicDTO = toPublicListingDTO(dbPublished!);
    assert.equal((publicDTO as any).host?.email, undefined, "Host email must NEVER leak in public DTO");
    assert.equal((publicDTO as any).doorCode, undefined, "doorCode must NEVER leak in public DTO");
    assert.equal((publicDTO as any).lockboxCode, undefined, "lockboxCode must NEVER leak in public DTO");
    assert.equal((publicDTO as any).wifiPassword, undefined, "wifiPassword must NEVER leak in public DTO");
    assert.equal((publicDTO as any).payoutMethod, undefined, "payoutMethod must NEVER leak in public DTO");
    console.log("✔ Custom slug routing and Public DTO privacy protection verified");

    // ─────────────────────────────────────────────────────────────────
    // 7. AUTHORIZATION & MULTI-TENANCY PROTECTION
    // ─────────────────────────────────────────────────────────────────
    console.log("▶ 7. Testing Authorization (Rogue Host Cannot Alter Listing)...");
    let rogueEditBlocked = false;
    try {
      await listingService.update(rogueActor, draftListing.id, { title: "Hacked Title" });
    } catch {
      rogueEditBlocked = true;
    }
    assert.ok(rogueEditBlocked, "Rogue user cannot update another host's listing");

    let roguePublishBlocked = false;
    try {
      await listingService.publish(rogueActor, draftListing.id);
    } catch {
      roguePublishBlocked = true;
    }
    assert.ok(roguePublishBlocked, "Rogue user cannot publish another host's listing");

    let rogueUnpublishBlocked = false;
    try {
      await listingService.unpublish(rogueActor, draftListing.id);
    } catch {
      rogueUnpublishBlocked = true;
    }
    assert.ok(rogueUnpublishBlocked, "Rogue user cannot unpublish another host's listing");
    console.log("✔ Authorization & Multi-tenant isolation verified");

    console.log("\n=======================================================");
    console.log("PHASE E6 MASTER PRODUCTION QA INTEGRATION TEST PASSED 100%");
    console.log("=======================================================");
  } finally {
    // Cleanup created test records
    for (const id of createdListingIds) {
      await prisma.listing.deleteMany({ where: { id } }).catch(() => {});
    }
    for (const id of createdUserIds) {
      await prisma.user.deleteMany({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

runPhaseE6ProductionQATest().catch((err) => {
  console.error("Phase E6 Production QA Test Failed:", err);
  process.exit(1);
});
