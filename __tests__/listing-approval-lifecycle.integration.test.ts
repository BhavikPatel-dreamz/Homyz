import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";

import { Role, ListingStatus } from "../generated/prisma/enums";
import { prisma } from "../lib/db/prisma";
import { createListingSchema } from "../lib/validation/listing";
import { listingService } from "../services/listing.service";

const runDatabaseTests = process.env.RUN_DB_INTEGRATION_TESTS === "1";

test("listing approval lifecycle keeps submitted and edited listings private until Admin approval", { skip: !runDatabaseTests }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdListingIds: string[] = [];
  const createdUserIds: string[] = [];

  try {
    const [host, admin] = await Promise.all([
      prisma.user.create({
        data: { name: "Lifecycle Host", email: `listing-lifecycle-host-${suffix}@example.test`, role: Role.USER },
      }),
      prisma.user.create({
        data: { name: "Lifecycle Admin", email: `listing-lifecycle-admin-${suffix}@example.test`, role: Role.ADMIN },
      }),
    ]);
    createdUserIds.push(host.id, admin.id);

    const hostActor = { id: host.id, email: host.email, role: Role.USER };
    const adminActor = { id: admin.id, email: admin.email, role: Role.ADMIN };
    const draft = await listingService.create(hostActor, createListingSchema.parse({
      title: "International approval lifecycle home",
      description: "A complete international home that must remain private until an administrator approves it.",
      price: 18000,
      weekendPrice: 21000,
      propertyType: "HOUSE",
      listingType: "ENTIRE_PLACE",
      address: "100 Review Street",
      city: "Paris",
      country: "France",
      latitude: 48.8566,
      longitude: 2.3522,
      guests: 4,
      bedrooms: 2,
      beds: 2,
      bathrooms: 1,
      photos: Array.from({ length: 5 }, (_, index) => `/uploads/listing-photos/lifecycle-${suffix}-${index}.jpg`),
      safetyDisclosures: ["SECURITY_CAMERA:NO", "NOISE_MONITOR:NO", "WEAPONS:NO"],
    }));
    createdListingIds.push(draft.id);

    assert.equal(draft.status, ListingStatus.DRAFT);
    assert.equal(draft.published, false);

    // Legacy publish callers must now submit, never activate a listing.
    const submitted = await listingService.publish(hostActor, draft.id);
    assert.equal(submitted.status, ListingStatus.PENDING_REVIEW);
    assert.equal(submitted.published, false);
    await assert.rejects(() => listingService.getPublicListingById(draft.id));

    const approved = await listingService.approveListingByAdmin(adminActor, draft.id);
    assert.equal(approved.status, ListingStatus.ACTIVE);
    assert.equal(approved.published, true);
    assert.equal((await listingService.getPublicListingById(draft.id))?.id, draft.id);
    const approvedHostActor = { ...hostActor, role: Role.HOST };

    // Material host edits must remove the live listing and request re-approval.
    const edited = await listingService.update(approvedHostActor, draft.id, {
      title: "International approval lifecycle home — revised",
    });
    assert.equal(edited.status, ListingStatus.PENDING_REVIEW);
    assert.equal(edited.published, false);
    await assert.rejects(() => listingService.getPublicListingById(draft.id));

    const changesRequested = await listingService.requestChangesByAdmin(
      adminActor,
      draft.id,
      "Clarify the guest-access instructions.",
    );
    assert.equal(changesRequested.status, ListingStatus.CHANGES_REQUESTED);
    assert.equal(changesRequested.published, false);

    const resubmitted = await listingService.resubmitForReview(approvedHostActor, draft.id);
    assert.equal(resubmitted.status, ListingStatus.PENDING_REVIEW);

    const rejected = await listingService.rejectListingByAdmin(
      adminActor,
      draft.id,
      "The listing description needs a safety clarification.",
    );
    assert.equal(rejected.status, ListingStatus.REJECTED);
    assert.equal(rejected.published, false);
    assert.equal(rejected.rejectionReason, "The listing description needs a safety clarification.");

    const resubmittedAfterRejection = await listingService.resubmitForReview(approvedHostActor, draft.id);
    assert.equal(resubmittedAfterRejection.status, ListingStatus.PENDING_REVIEW);

    const approvedAgain = await listingService.approveListingByAdmin(adminActor, draft.id);
    assert.equal(approvedAgain.status, ListingStatus.ACTIVE);
    assert.equal(approvedAgain.published, true);

    const unpublished = await listingService.unpublish(approvedHostActor, draft.id);
    assert.equal(unpublished.status, ListingStatus.DRAFT);
    assert.equal(unpublished.published, false);
    await assert.rejects(() => listingService.getPublicListingById(draft.id));
  } finally {
    if (createdListingIds.length) {
      await prisma.listing.deleteMany({ where: { id: { in: createdListingIds } } });
    }
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  }
});
