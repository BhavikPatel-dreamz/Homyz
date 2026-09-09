import "dotenv/config";
import assert from "node:assert/strict";
import { Role } from "../generated/prisma/enums";
import { prisma } from "../lib/db/prisma";
import { createListingSchema, updateListingSchema } from "../lib/validation/listing";
import { listingService } from "../services/listing.service";
import { toPublicListingDTO } from "../services/mappers";

async function run() {
 if (process.env.RUN_DB_INTEGRATION_TESTS !== "1") { console.log("Skipped DB round-trip test (set RUN_DB_INTEGRATION_TESTS=1 to run)."); return; }
 const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
 const email = `e1-e2-${suffix}@example.test`;
 let userId: string | undefined;
 let listingId: string | undefined;
 try {
  const user = await prisma.user.create({ data: { email, name: "E1 E2 test host", role: Role.USER } });
  userId = user.id;
  const actor = { id: user.id, email: user.email, role: Role.USER };
  const created = await listingService.create(actor, createListingSchema.parse({ title: "E1 E2 database round trip", address: "1 Test Street", city: "Riyadh", country: "Saudi Arabia", latitude: 24.71, longitude: 46.67 }));
  listingId = created.id;
  const payload = updateListingSchema.parse({
    descriptionSections: { property: "Quiet, sunlit home.", guestAccess: "Private entrance.", guestInteraction: "Available by message.", otherDetails: "Please remove shoes." },
    neighborhoodDescription: "Near cafes and the metro.",
    gettingAround: "Walk five minutes to transit.",
  });
  await listingService.update(actor, created.id, payload);
  const saved = await prisma.listing.findUniqueOrThrow({ where: { id: created.id } });
  assert.deepEqual(saved.descriptionSections, payload.descriptionSections);
  assert.equal(saved.neighborhoodDescription, payload.neighborhoodDescription);
  assert.equal(saved.gettingAround, payload.gettingAround);
  const publicListing = toPublicListingDTO(saved);
  assert.deepEqual(publicListing.descriptionSections, payload.descriptionSections);
  assert.equal(publicListing.neighborhoodDescription, payload.neighborhoodDescription);
  assert.equal(publicListing.gettingAround, payload.gettingAround);
  console.log("E1/E2 authenticated owner service round-trip and public DTO test passed.");
 } finally {
  if (listingId) await prisma.listing.delete({ where: { id: listingId } }).catch(() => undefined);
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  await prisma.$disconnect();
 }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
