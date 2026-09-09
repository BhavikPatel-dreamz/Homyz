import "dotenv/config";
import assert from "node:assert/strict";
import { Role, ListingStatus, BookingStatus } from "../generated/prisma/enums";
import type { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/db/prisma";
import { bookingService } from "../services/booking.service";
import { listingService } from "../services/listing.service";
import { toPublicListingDTO } from "../services/mappers";

const date = (day: number) => new Date(Date.UTC(2031, 9, day));

async function run() {
  if (process.env.RUN_DB_INTEGRATION_TESTS !== "1") { console.log("Skipped E4 booking integration test (set RUN_DB_INTEGRATION_TESTS=1 to run)."); return; }
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const createdListingIds: string[] = [];
  const createdUserIds: string[] = [];
  try {
    const host = await prisma.user.create({ data: { email: `e4-host-${suffix}@example.test`, name: "E4 host", role: Role.USER } });
    const guestA = await prisma.user.create({ data: { email: `e4-guest-a-${suffix}@example.test`, name: "E4 guest A", role: Role.USER } });
    const guestB = await prisma.user.create({ data: { email: `e4-guest-b-${suffix}@example.test`, name: "E4 guest B", role: Role.USER } });
    createdUserIds.push(host.id, guestA.id, guestB.id);
    const hostActor = { id: host.id, email: host.email, role: Role.USER };
    const guestActorA = { id: guestA.id, email: guestA.email, role: Role.USER };
    const guestActorB = { id: guestB.id, email: guestB.email, role: Role.USER };
    const createListing = async (title: string) => {
      const listing = await prisma.listing.create({ data: {
        hostId: host.id, title, description: "E4 database test listing", price: 10000, published: true, status: ListingStatus.ACTIVE,
        guests: 2, minNights: 1, maxNights: 365, instantBook: true, cleaningFee: 2500, weekendPrice: 15000,
        discounts: { weekly: { enabled: true, percentage: 10 }, monthly: { enabled: true, percentage: 20 } },
        cancellationPolicy: "FLEXIBLE", longTermCancellationPolicy: "STRICT", bookingMessage: "Please review the rules before reserving.",
        petsAllowed: false, smokingAllowed: false, eventsAllowed: false, photographyAllowed: false, quietHours: true, quietHoursStart: "22:00", quietHoursEnd: "07:00", safetyEquipment: ["SMOKE_ALARM"], safetyHazards: ["Nearby water"], checkInStart: "15:00", checkInEnd: "22:00", checkOutTime: "11:00", additionalRules: "No shoes indoors.",
      } });
      createdListingIds.push(listing.id);
      return listing;
    };
    const listing = await createListing("E4 booking primary");

    await listingService.update(hostActor, listing.id, { instantBook: true, bookingMessage: "Please review the rules before reserving.", longTermCancellationPolicy: "STRICT", cancellationPolicy: "FLEXIBLE", petsAllowed: false, maxPets: null, petFee: null, smokingAllowed: false, eventsAllowed: false, photographyAllowed: false, quietHours: true, quietHoursStart: "22:00", quietHoursEnd: "07:00", checkInStart: "15:00", checkInEnd: "22:00", checkOutTime: "11:00", additionalRules: "No shoes indoors.", safetyEquipment: ["SMOKE_ALARM"], safetyHazards: ["Nearby water"] });
    await prisma.listing.update({ where: { id: listing.id }, data: { price: 10000, cleaningFee: 2500, weekendPrice: 15000, discounts: { weekly: { enabled: true, percentage: 10 }, monthly: { enabled: true, percentage: 20 } } } });
    const saved = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    const publicListing = toPublicListingDTO(saved);
    assert.equal(saved.bookingMessage, "Please review the rules before reserving.");
    assert.equal(saved.longTermCancellationPolicy, "STRICT");
    assert.equal(publicListing.bookingMessage, saved.bookingMessage);
    assert.equal(publicListing.longTermCancellationPolicy, "STRICT");
    assert.equal("petFee" in publicListing, false);

    const one = await bookingService.getQuote({ listingId: listing.id, checkIn: date(1), checkOut: date(2), guests: 1 });
    const six = await bookingService.getQuote({ listingId: listing.id, checkIn: date(1), checkOut: date(7), guests: 1 });
    const seven = await bookingService.getQuote({ listingId: listing.id, checkIn: date(1), checkOut: date(8), guests: 1 });
    const twentySeven = await bookingService.getQuote({ listingId: listing.id, checkIn: date(1), checkOut: date(28), guests: 1 });
    const twentyEight = await bookingService.getQuote({ listingId: listing.id, checkIn: date(1), checkOut: date(29), guests: 1 });
    const thirty = await bookingService.getQuote({ listingId: listing.id, checkIn: date(1), checkOut: date(31), guests: 1 });
    assert.equal(one.discountPercentage, 0); assert.equal(six.discountPercentage, 0); assert.equal(seven.discountPercentage, 10); assert.equal(twentySeven.discountPercentage, 10); assert.equal(twentyEight.discountPercentage, 20); assert.equal(thirty.discountPercentage, 20);
    assert.equal(twentySeven.cancellationPolicyType, "SHORT_TERM"); assert.equal(twentySeven.cancellationPolicy, "FLEXIBLE"); assert.equal(twentyEight.cancellationPolicyType, "LONG_TERM"); assert.equal(twentyEight.cancellationPolicy, "STRICT");
    assert(seven.weekendNights > 0, "quote includes configured Thursday/Friday weekend pricing");

    const instant = await bookingService.create(guestActorA, { listingId: listing.id, startDate: date(40), endDate: date(47), guests: 1 });
    assert.equal(instant.status, BookingStatus.CONFIRMED);
    const instantSnapshot = await prisma.booking.findUniqueOrThrow({ where: { id: instant.id } });
    assert.equal(instantSnapshot.cancellationPolicy, "FLEXIBLE");
    const storedQuote = instantSnapshot.priceBreakdown as { totalPrice: number; discountPercentage: number };
    assert.equal(instantSnapshot.totalPrice, storedQuote.totalPrice); assert.equal(storedQuote.discountPercentage, 10);
    const longStay = await bookingService.create(guestActorB, { listingId: listing.id, startDate: date(100), endDate: date(128), guests: 1 });
    const longStaySnapshot = await prisma.booking.findUniqueOrThrow({ where: { id: longStay.id } });
    assert.equal(longStaySnapshot.cancellationPolicy, "STRICT");
    await prisma.listing.update({ where: { id: listing.id }, data: { price: 99999, cancellationPolicy: "FIRM" } });
    const historical = await prisma.booking.findUniqueOrThrow({ where: { id: instant.id } });
    assert.equal(historical.totalPrice, instantSnapshot.totalPrice); assert.equal(historical.cancellationPolicy, "FLEXIBLE");
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: longStay.id } })).cancellationPolicy, "STRICT");

    await prisma.listing.update({ where: { id: listing.id }, data: { instantBook: false } });
    const request = await bookingService.create(guestActorB, { listingId: listing.id, startDate: date(50), endDate: date(52), guests: 1 });
    assert.equal(request.status, BookingStatus.PENDING);

    await prisma.listing.update({ where: { id: listing.id }, data: { instantBook: true } });
    const concurrent = await Promise.allSettled([
      bookingService.create(guestActorA, { listingId: listing.id, startDate: date(60), endDate: date(65), guests: 1 }),
      bookingService.create(guestActorB, { listingId: listing.id, startDate: date(62), endDate: date(64), guests: 1 }),
    ]);
    assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(concurrent.filter((result) => result.status === "rejected").length, 1);
    await bookingService.create(guestActorB, { listingId: listing.id, startDate: date(65), endDate: date(68), guests: 1 });
    const conflict = await Promise.allSettled([bookingService.create(guestActorB, { listingId: listing.id, startDate: date(66), endDate: date(68), guests: 1 })]);
    assert.equal(conflict[0].status, "rejected");
    await bookingService.create(guestActorB, { listingId: listing.id, startDate: date(70), endDate: date(72), guests: 1 });

    const listingB = await createListing("E4 booking parallel");
    const parallel = await Promise.all([
      bookingService.create(guestActorA, { listingId: listing.id, startDate: date(80), endDate: date(82), guests: 1 }),
      bookingService.create(guestActorB, { listingId: listingB.id, startDate: date(80), endDate: date(82), guests: 1 }),
    ]);
    assert.equal(parallel.length, 2);

    // 28. Concurrency transaction failure test — verify lock auto-release on abort
    await assert.rejects(async () => {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${listing.id}))`;
        throw new Error("Simulated transactional abort");
      });
    });
    // Immediately afterward, a subsequent booking must NOT deadlock and must succeed
    const afterAbort = await bookingService.create(guestActorA, {
      listingId: listing.id,
      startDate: date(85),
      endDate: date(87),
      guests: 1,
    });
    assert.equal(afterAbort.status, BookingStatus.CONFIRMED);

    // 29. Boundary booking test
    // Existing booking: Oct 10 to Oct 15
    await bookingService.create(guestActorA, {
      listingId: listing.id,
      startDate: date(10),
      endDate: date(15),
      guests: 1,
    });
    // Attempt adjacent checkout/check-in: Oct 15 to Oct 18 (succeeds)
    const adjacent = await bookingService.create(guestActorB, {
      listingId: listing.id,
      startDate: date(15),
      endDate: date(18),
      guests: 1,
    });
    assert.equal(adjacent.status, BookingStatus.CONFIRMED);
    // Overlapping attempt: Oct 14 to Oct 16 (must conflict and reject)
    await assert.rejects(
      async () => {
        await bookingService.create(guestActorB, {
          listingId: listing.id,
          startDate: date(14),
          endDate: date(16),
          guests: 1,
        });
      },
      (err: any) => err.status === 409 || (typeof err.message === "string" && err.message.includes("no longer available")),
    );

    // 31. Pet negative & positive tests
    // Listing currently has petsAllowed = false
    await assert.rejects(
      async () => {
        await bookingService.create(guestActorA, {
          listingId: listing.id,
          startDate: date(90),
          endDate: date(92),
          guests: 1,
          pets: 1,
        });
      },
      (err: any) => err.status === 400 && (typeof err.message === "string" && err.message.includes("Pets are not allowed")),
    );

    // Update listing to allow pets with maxPets = 2
    await listingService.update(hostActor, listing.id, {
      petsAllowed: true,
      maxPets: 2,
    });
    // Guest submits pets = 3 (exceeds maxPets = 2) -> reject
    await assert.rejects(
      async () => {
        await bookingService.create(guestActorA, {
          listingId: listing.id,
          startDate: date(90),
          endDate: date(92),
          guests: 1,
          pets: 3,
        });
      },
      (err: any) => err.status === 400 && (typeof err.message === "string" && err.message.includes("maximum of 2 pets")),
    );
    // Guest submits pets = 2 (valid) -> succeeds!
    const petBooking = await bookingService.create(guestActorA, {
      listingId: listing.id,
      startDate: date(90),
      endDate: date(92),
      guests: 1,
      pets: 2,
    });
    assert.equal(petBooking.status, BookingStatus.CONFIRMED);
    const petBookingSnapshot = await prisma.booking.findUniqueOrThrow({ where: { id: petBooking.id } });
    const petBreakdown = petBookingSnapshot.priceBreakdown as { pets?: number };
    assert.equal(petBreakdown.pets, 2);

    // 32. Authorization tests
    // Host B cannot update Host A listing E4 settings
    const hostB = await prisma.user.create({ data: { email: `e4-host-b-${suffix}@example.test`, name: "E4 host B", role: Role.USER } });
    createdUserIds.push(hostB.id);
    const hostActorB = { id: hostB.id, email: hostB.email, role: Role.USER };

    await assert.rejects(
      async () => {
        await listingService.update(hostActorB, listing.id, { instantBook: false });
      },
      (err: any) => err.status === 403 || (typeof err.message === "string" && (err.message.toLowerCase().includes("permission") || err.message.toLowerCase().includes("not authorized"))),
    );

    // Guest A cannot inspect Guest B booking
    await assert.rejects(
      async () => {
        await bookingService.getById(guestActorA, request.id);
      },
      (err: any) => err.status === 403 || (typeof err.message === "string" && (err.message.toLowerCase().includes("unauthorized") || err.message.toLowerCase().includes("forbidden"))),
    );

    // Host A cannot book their own listing
    await assert.rejects(
      async () => {
        await bookingService.create(hostActor, {
          listingId: listing.id,
          startDate: date(95),
          endDate: date(97),
          guests: 1,
        });
      },
      (err: any) => err.status === 400 && (typeof err.message === "string" && err.message.includes("Hosts cannot book their own listings")),
    );

    // 33. Privacy regression: Public DTO must NOT expose secrets or petFee
    const freshPublicListing = toPublicListingDTO(await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } }));
    assert.equal("petFee" in freshPublicListing, false);
    for (const secret of ["wifiPassword", "doorCode", "lockboxCode", "checkInInstructions", "houseManual", "directions", "parkingInstructions"]) {
      assert.equal(secret in freshPublicListing, false);
    }

    console.log("E4 real DB round-trip, pricing boundaries, instant/request booking, snapshots, adjacency, and advisory-lock concurrency passed.");
  } finally {
    if (createdListingIds.length) await prisma.booking.deleteMany({ where: { listingId: { in: createdListingIds } } });
    for (const id of createdListingIds) await prisma.listing.delete({ where: { id } }).catch(() => undefined);
    for (const id of createdUserIds) await prisma.user.delete({ where: { id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
