import "dotenv/config";
import assert from "node:assert/strict";
import { Role } from "../generated/prisma/enums";
import { prisma } from "../lib/db/prisma";
import { createListingSchema, updateListingSchema } from "../lib/validation/listing";
import { listingService } from "../services/listing.service";

async function run() {
  if (process.env.RUN_DB_INTEGRATION_TESTS !== "1") {
    console.log("Skipped listing data-integrity DB test (set RUN_DB_INTEGRATION_TESTS=1 to run).");
    return;
  }

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `listing-integrity-${suffix}@example.test`;
  let userId: string | undefined;
  let listingId: string | undefined;

  try {
    const user = await prisma.user.create({
      data: { email, name: "Listing integrity test host", role: Role.HOST },
    });
    userId = user.id;
    const actor = { id: user.id, email: user.email, role: Role.HOST };

    const created = await listingService.create(actor, createListingSchema.parse({
      title: "Initial title",
      description: "Initial description",
      price: 20_000,
      amenities: ["wifi"],
    }));
    listingId = created.id;

    const firstPhoto = "/uploads/listing-photos/2026/11/listing-integrity-a.jpg";
    const secondPhoto = "/uploads/listing-photos/2026/11/listing-integrity-b.jpg";

    await listingService.update(actor, listingId, updateListingSchema.parse({
      title: "Premium Apartment Near City Center",
    }));
    await listingService.update(actor, listingId, updateListingSchema.parse({
      photos: [firstPhoto],
    }));

    let saved = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    assert.equal(saved.title, "Premium Apartment Near City Center");
    assert.deepEqual(saved.photos, [firstPhoto]);
    assert.deepEqual(saved.amenities, ["wifi"]);
    assert.equal(saved.description, "Initial description");

    await Promise.all([
      listingService.update(actor, listingId, updateListingSchema.parse({
        title: "Title saved alongside photos",
      })),
      listingService.update(actor, listingId, updateListingSchema.parse({
        photos: [firstPhoto, secondPhoto],
      })),
    ]);

    saved = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    assert.equal(saved.title, "Title saved alongside photos");
    assert.deepEqual(saved.photos, [firstPhoto, secondPhoto]);
    assert.deepEqual(saved.amenities, ["wifi"]);
    assert.equal(saved.description, "Initial description");
    console.log("Listing title/photo scoped update DB test passed.");
  } finally {
    if (listingId) await prisma.listing.delete({ where: { id: listingId } }).catch(() => undefined);
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
