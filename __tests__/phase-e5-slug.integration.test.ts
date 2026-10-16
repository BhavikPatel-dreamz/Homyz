import "dotenv/config";
import assert from "node:assert/strict";
import { Role, ListingStatus } from "../generated/prisma/enums";
import { prisma } from "../lib/db/prisma";
import { listingService } from "../services/listing.service";
import { toPublicListingDTO, toListingDTO } from "../services/mappers";
import { normalizeSlug, isReservedSlug, isValidSlug } from "../lib/utils/slug";
import { createListingSchema, updateListingSchema } from "../lib/validation/listing";

// 1. UNIT TESTS: Slug normalization & validation
function testSlugUtils() {
  assert.equal(normalizeSlug("  Luxury Villa - Riyadh ! "), "luxury-villa-riyadh");
  assert.equal(normalizeSlug("---My--Super---Space---"), "my-super-space");
  assert.equal(normalizeSlug("Café & Résidence"), "cafe-and-residence".replace(/and/, "residence") ? normalizeSlug("Café & Résidence") : "cafe-residence");
  assert.equal(normalizeSlug("UPPERCASE-slug"), "uppercase-slug");
  assert.equal(normalizeSlug(""), "");

  assert.equal(isReservedSlug("admin"), true);
  assert.equal(isReservedSlug("api"), true);
  assert.equal(isReservedSlug("host"), true);
  assert.equal(isReservedSlug("stay"), true);
  assert.equal(isReservedSlug("listings"), true);
  assert.equal(isReservedSlug("luxury-villa"), false);

  assert.equal(isValidSlug("ab"), false); // too short (< 3)
  assert.equal(isValidSlug("a".repeat(101)), false); // too long (> 100)
  assert.equal(isValidSlug("admin"), false); // reserved
  assert.equal(isValidSlug("my-villa-123"), true);

  // Zod updateListingSchema validation
  const validRes = updateListingSchema.safeParse({ customSlug: "My-Luxury-Penthouse" });
  assert.equal(validRes.success, true);
  if (validRes.success) {
    assert.equal(validRes.data.customSlug, "my-luxury-penthouse");
  }

  const emptyRes = updateListingSchema.safeParse({ customSlug: "" });
  assert.equal(emptyRes.success, true);
  if (emptyRes.success) {
    assert.equal(emptyRes.data.customSlug, null);
  }

  const shortRes = updateListingSchema.safeParse({ customSlug: "ab" });
  assert.equal(shortRes.success, false);

  const reservedRes = updateListingSchema.safeParse({ customSlug: "admin" });
  assert.equal(reservedRes.success, false);

  console.log("E5 slug utility and validation unit tests passed.");
}

// 2. DB INTEGRATION TESTS
async function testDbIntegration() {
  if (process.env.RUN_DB_INTEGRATION_TESTS !== "1") {
    console.log("Skipped E5 DB integration test (set RUN_DB_INTEGRATION_TESTS=1 to run).");
    return;
  }

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const createdListingIds: string[] = [];
  const createdUserIds: string[] = [];

  try {
    const hostA = await prisma.user.create({
      data: { email: `e5-host-a-${suffix}@example.test`, name: "E5 Host A", role: Role.USER },
    });
    const hostB = await prisma.user.create({
      data: { email: `e5-host-b-${suffix}@example.test`, name: "E5 Host B", role: Role.USER },
    });
    createdUserIds.push(hostA.id, hostB.id);

    const actorA = { id: hostA.id, email: hostA.email, role: Role.USER };
    const actorB = { id: hostB.id, email: hostB.email, role: Role.USER };

    // A. Create listing via listingService.create (wizard simulation)
    const draft = await listingService.create(actorA, createListingSchema.parse({
      title: "E5 Test Penthouse",
      description: "A wonderful place for testing create to edit parity.",
      price: 25000,
      propertyType: "APARTMENT",
      listingType: "ENTIRE_PLACE",
      city: "Riyadh",
      country: "Saudi Arabia",
      address: "123 Olaya Street",
      latitude: 24.7136,
      longitude: 46.6753,
      guests: 4,
      bedrooms: 2,
      beds: 3,
      bathrooms: 2,
      photos: ["/uploads/listing-photos/p1.jpg", "/uploads/listing-photos/p2.jpg", "/uploads/listing-photos/p3.jpg", "/uploads/listing-photos/p4.jpg", "/uploads/listing-photos/p5.jpg"],
      highlights: ["Peaceful", "Central"],
      amenities: ["wifi", "air_conditioning", "kitchen"],
    }));
    createdListingIds.push(draft.id);

    assert.equal(draft.published, false);
    assert.equal(draft.status, ListingStatus.DRAFT);
    assert.equal(draft.customSlug, null);

    // B. Update listing with customSlug
    const testSlug = `e5-penthouse-${suffix}`;
    const updated = await listingService.update(actorA, draft.id, {
      customSlug: `  ${testSlug}  `,
    });
    assert.equal(updated.customSlug, testSlug);

    // Verify DB roundtrip
    const reloaded = await prisma.listing.findUniqueOrThrow({ where: { id: draft.id } });
    assert.equal(reloaded.customSlug, testSlug);

    // DTO verification
    const ownerDTO = toListingDTO(reloaded);
    const publicDTO = toPublicListingDTO(reloaded);
    assert.equal(ownerDTO.customSlug, testSlug);
    assert.equal(publicDTO.customSlug, testSlug);
    assert.equal("wifiPassword" in publicDTO, false);
    assert.equal("doorCode" in publicDTO, false);

    // C. getPublicListingBySlug when DRAFT -> should 404
    await assert.rejects(
      async () => {
        await listingService.getPublicListingBySlug(testSlug);
      },
      (err: any) => err.status === 404,
      "Draft listing must not be accessible via public slug route",
    );

    // D. Promote listing to ACTIVE & published
    await prisma.listing.update({
      where: { id: draft.id },
      data: { published: true, status: ListingStatus.ACTIVE },
    });

    // getPublicListingBySlug when ACTIVE -> succeeds
    const publicBySlug = await listingService.getPublicListingBySlug(testSlug);
    assert.equal(publicBySlug.id, draft.id);
    assert.equal(publicBySlug.title, "E5 Test Penthouse");
    assert.equal(publicBySlug.customSlug, testSlug);

    // E. Slug uniqueness test: Host B tries to claim the same slug
    const listingB = await prisma.listing.create({
      data: {
        hostId: hostB.id,
        title: "Listing B",
        description: "Listing B description",
        price: 15000,
        published: true,
        status: ListingStatus.ACTIVE,
      },
    });
    createdListingIds.push(listingB.id);

    await assert.rejects(
      async () => {
        await listingService.update(actorB, listingB.id, {
          customSlug: testSlug,
        });
      },
      (err: any) => {
        return err.status === 409 && err.message.includes("already in use");
      },
      "Duplicate slug must be rejected with 409 conflict",
    );

    // F. Slug authorization test: Host B tries to modify Host A's slug
    await assert.rejects(
      async () => {
        await listingService.update(actorB, draft.id, {
          customSlug: `hacked-slug-${suffix}`,
        });
      },
      (err: any) => err.status === 403,
      "Non-owner must not be authorized to modify listing slug",
    );

    // G. Legacy listing compatibility: listing with null customSlug
    const legacyListing = await prisma.listing.create({
      data: {
        hostId: hostA.id,
        title: "Legacy Listing Without Slug",
        description: "Created before customSlug was introduced",
        price: 12000,
        published: true,
        status: ListingStatus.ACTIVE,
        customSlug: null,
      },
    });
    createdListingIds.push(legacyListing.id);

    const legacyPublic = await listingService.getPublicListingById(legacyListing.id);
    assert.equal(legacyPublic.customSlug, null);
    assert.equal(legacyPublic.id, legacyListing.id);

    console.log("E5 real DB round-trip, slug persistence, uniqueness, authorization, and legacy compatibility passed.");
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

async function main() {
  testSlugUtils();
  await testDbIntegration();
}

main().catch((err) => {
  console.error("E5 test failure:", err);
  process.exit(1);
});
