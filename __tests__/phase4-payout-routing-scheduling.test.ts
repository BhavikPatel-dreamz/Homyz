import "dotenv/config";
import assert from "node:assert";
import { prisma } from "../lib/db/prisma";
import { Role, BookingStatus, ListingCoHostStatus, PaymentStatus } from "@/generated/prisma/enums";
import { payoutRoutingService } from "../services/payout-routing.service";
import { payoutService } from "../services/payout.service";

// Known valid Saudi IBANs for test bank accounts
const VALID_SNB_IBAN = "SA0910000000000000000001";
const VALID_RAJHI_IBAN = "SA0380000000608010167519";
const VALID_RIYAD_IBAN = "SA2020000000000000000002";

async function runTests() {
  console.log("=== RUNNING HOMYZ PHASE 4 COMPREHENSIVE TEST SUITE ===\n");

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (error: any) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${error.message}`);
      if (error.stack) {
        console.error(`    Stack: ${error.stack.split("\n").slice(0, 3).join("\n")}`);
      }
      failed++;
    }
  }

  const timestamp = Date.now();
  let adminUser: any = null;
  let hostUser: any = null;
  let coHostUser: any = null;
  let unauthorizedUser: any = null;
  let hostMethod: any = null;
  let coHostMethod: any = null;
  let testListing: any = null;
  let testBooking: any = null;

  try {
    // ───────────────────────────────────────────────────────────────────────────
    // SETUP: Create Test Entities in Database
    // ───────────────────────────────────────────────────────────────────────────
    console.log("Setup: Preparing test users, accounts, listing, and co-host relationship");

    adminUser = await prisma.user.create({
      data: {
        email: `admin-p4-${timestamp}@example.com`,
        name: "Admin Phase 4",
        role: Role.ADMIN,
      },
    });

    hostUser = await prisma.user.create({
      data: {
        email: `host-p4-${timestamp}@example.com`,
        name: "Host Phase 4",
        role: Role.HOST,
      },
    });

    coHostUser = await prisma.user.create({
      data: {
        email: `cohost-p4-${timestamp}@example.com`,
        name: "CoHost Phase 4",
        role: Role.HOST,
      },
    });

    unauthorizedUser = await prisma.user.create({
      data: {
        email: `stranger-p4-${timestamp}@example.com`,
        name: "Stranger Phase 4",
        role: Role.HOST,
      },
    });

    // Add verified payout methods
    hostMethod = await payoutService.addHostPayoutMethod(hostUser.id, {
      accountHolderName: "Host Phase 4",
      bankName: "Saudi National Bank (SNB)",
      iban: VALID_SNB_IBAN,
      currency: "SAR",
      isDefault: true,
    });
    // Verify it
    await payoutService.verifyHostPayoutMethod(adminUser, hostUser.id, hostMethod.id, "VERIFIED");

    coHostMethod = await payoutService.addHostPayoutMethod(coHostUser.id, {
      accountHolderName: "CoHost Phase 4",
      bankName: "Al Rajhi Bank",
      iban: VALID_RAJHI_IBAN,
      currency: "SAR",
      isDefault: true,
    });
    // Verify it
    await payoutService.verifyHostPayoutMethod(adminUser, coHostUser.id, coHostMethod.id, "VERIFIED");

    // Create listing owned by hostUser
    testListing = await prisma.listing.create({
      data: {
        hostId: hostUser.id,
        title: `Luxury Riyadh Villa ${timestamp}`,
        description: "Test listing for Phase 4 payout routing",
        price: 100000, // 1000.00 SAR
        city: "Riyadh",
        country: "Saudi Arabia",
        published: true,
      },
    });

    // Create accepted co-host relation
    await prisma.listingCoHost.create({
      data: {
        listingId: testListing.id,
        inviterHostId: hostUser.id,
        userId: coHostUser.id,
        status: ListingCoHostStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });

    console.log("  ✓ Setup completed successfully.\n");

    // ───────────────────────────────────────────────────────────────────────────
    // SUITE 1: Percentage Split Engine & Zero-Drift Halala Calculation
    // ───────────────────────────────────────────────────────────────────────────
    console.log("Suite 1: Calculation Engine & Deterministic Halala Rounding");

    await test("80/20 split calculates exact halalas with zero remainder", async () => {
      const mockBooking = {
        id: `mock-bk-1-${timestamp}`,
        listingId: testListing.id,
        listing: { hostId: hostUser.id },
      };

      // Set rules: 80% host, 20% co-host
      await payoutRoutingService.saveListingRoutingRules(
        hostUser.id,
        testListing.id,
        [
          {
            recipientUserId: hostUser.id,
            payoutMethodId: hostMethod.id,
            allocationPercentage: 80,
          },
          {
            recipientUserId: coHostUser.id,
            payoutMethodId: coHostMethod.id,
            allocationPercentage: 20,
          },
        ],
        { id: hostUser.id, email: hostUser.email!, role: Role.HOST },
      );

      const netPayoutMinorUnits = 100000; // 1,000.00 SAR
      const splits = await payoutRoutingService.calculateDistributionForBooking(
        mockBooking as any,
        netPayoutMinorUnits,
      );

      assert.strictEqual(splits.length, 2);
      const hostSplit = splits.find((s) => s.recipientUserId === hostUser.id);
      const coHostSplit = splits.find((s) => s.recipientUserId === coHostUser.id);

      assert.ok(hostSplit);
      assert.ok(coHostSplit);
      assert.strictEqual(hostSplit!.amountCents, 80000); // 800.00 SAR
      assert.strictEqual(coHostSplit!.amountCents, 20000); // 200.00 SAR
      assert.strictEqual(hostSplit!.amountCents + coHostSplit!.amountCents, netPayoutMinorUnits);
    });

    await test("Odd halala remainder is allocated to primary host (no halala lost or created)", async () => {
      const mockBooking = {
        id: `mock-bk-2-${timestamp}`,
        listingId: testListing.id,
        listing: { hostId: hostUser.id },
      };

      // 10,001 halalas (100.01 SAR) with 50/50 split -> 5000 + 5000 = 10000, 1 halala remainder
      await payoutRoutingService.saveListingRoutingRules(
        hostUser.id,
        testListing.id,
        [
          {
            recipientUserId: hostUser.id,
            payoutMethodId: hostMethod.id,
            allocationPercentage: 50,
          },
          {
            recipientUserId: coHostUser.id,
            payoutMethodId: coHostMethod.id,
            allocationPercentage: 50,
          },
        ],
        { id: hostUser.id, email: hostUser.email!, role: Role.HOST },
      );

      const netPayoutMinorUnits = 10001; // 100.01 SAR
      const splits = await payoutRoutingService.calculateDistributionForBooking(
        mockBooking as any,
        netPayoutMinorUnits,
      );

      const hostSplit = splits.find((s) => s.recipientUserId === hostUser.id);
      const coHostSplit = splits.find((s) => s.recipientUserId === coHostUser.id);

      assert.strictEqual(coHostSplit!.amountCents, 5000); // Math.floor(10001 * 0.50) = 5000
      assert.strictEqual(hostSplit!.amountCents, 5001); // 5000 + 1 remainder halala
      // Exact sum must equal 10001
      assert.strictEqual(hostSplit!.amountCents + coHostSplit!.amountCents, 10001);
    });

    await test("Fallback to host default payout method when listing has no active rules", async () => {
      // Create listing without routing rules
      const listingNoRules = await prisma.listing.create({
        data: {
          hostId: hostUser.id,
          title: `Fallback Villa ${timestamp}`,
          description: "Fallback listing test",
          price: 50000,
          city: "Jeddah",
          country: "Saudi Arabia",
        },
      });

      const mockBooking = {
        id: `mock-bk-fallback-${timestamp}`,
        listingId: listingNoRules.id,
        listing: { hostId: hostUser.id },
      };

      const splits = await payoutRoutingService.calculateDistributionForBooking(
        mockBooking as any,
        50000,
      );

      assert.strictEqual(splits.length, 1);
      assert.strictEqual(splits[0].recipientUserId, hostUser.id);
      assert.strictEqual(splits[0].payoutMethodId, hostMethod.id);
      assert.strictEqual(splits[0].amountCents, 50000);
      assert.strictEqual(splits[0].allocationPercentage, 100);

      // Cleanup listing
      await prisma.listing.delete({ where: { id: listingNoRules.id } });
    });

    // ───────────────────────────────────────────────────────────────────────────
    // SUITE 2: Strict Routing Rule Validation & Security Bounds
    // ───────────────────────────────────────────────────────────────────────────
    console.log("\nSuite 2: Strict Routing Rule Validation & Security Bounds");

    await test("Rejects rule submission when sum < 100% (e.g. 90%)", async () => {
      await assert.rejects(
        async () => {
          await payoutRoutingService.saveListingRoutingRules(
            hostUser.id,
            testListing.id,
            [
              {
                recipientUserId: hostUser.id,
                payoutMethodId: hostMethod.id,
                allocationPercentage: 70,
              },
              {
                recipientUserId: coHostUser.id,
                payoutMethodId: coHostMethod.id,
                allocationPercentage: 20,
              },
            ],
            { id: hostUser.id, email: hostUser.email!, role: Role.HOST },
          );
        },
        (err: any) => {
          assert.ok(err.message.includes("Total allocation percentage") && err.message.includes("100%"));
          return true;
        },
      );
    });

    await test("Rejects rule submission when sum > 100% (e.g. 110%)", async () => {
      await assert.rejects(
        async () => {
          await payoutRoutingService.saveListingRoutingRules(
            hostUser.id,
            testListing.id,
            [
              {
                recipientUserId: hostUser.id,
                payoutMethodId: hostMethod.id,
                allocationPercentage: 60,
              },
              {
                recipientUserId: coHostUser.id,
                payoutMethodId: coHostMethod.id,
                allocationPercentage: 50,
              },
            ],
            { id: hostUser.id, email: hostUser.email!, role: Role.HOST },
          );
        },
        (err: any) => {
          assert.ok(err.message.includes("Total allocation percentage") && err.message.includes("100%"));
          return true;
        },
      );
    });

    await test("Rejects non-accepted co-host or stranger from receiving splits", async () => {
      await assert.rejects(
        async () => {
          await payoutRoutingService.saveListingRoutingRules(
            hostUser.id,
            testListing.id,
            [
              {
                recipientUserId: hostUser.id,
                payoutMethodId: hostMethod.id,
                allocationPercentage: 80,
              },
              {
                recipientUserId: unauthorizedUser.id,
                payoutMethodId: coHostMethod.id,
                allocationPercentage: 20,
              },
            ],
            { id: hostUser.id, email: hostUser.email!, role: Role.HOST },
          );
        },
        (err: any) => {
          assert.ok(err.message.includes("is not an authorized accepted co-host"));
          return true;
        },
      );
    });

    await test("Rejects unauthorized actor from modifying listing routing rules", async () => {
      await assert.rejects(
        async () => {
          await payoutRoutingService.saveListingRoutingRules(
            unauthorizedUser.id,
            testListing.id,
            [
              {
                recipientUserId: hostUser.id,
                payoutMethodId: hostMethod.id,
                allocationPercentage: 100,
              },
            ],
            { id: unauthorizedUser.id, email: unauthorizedUser.email!, role: Role.HOST },
          );
        },
        (err: any) => {
          assert.ok(err.status === 403 || err.code === "FORBIDDEN" || err.message.includes("access denied"));
          return true;
        },
      );
    });

    // ───────────────────────────────────────────────────────────────────────────
    // SUITE 3: Historical Immutability & Distribution Snapshots
    // ───────────────────────────────────────────────────────────────────────────
    console.log("\nSuite 3: Historical Snapshot Immutability & Lifecycle");

    // Create a real confirmed booking in database
    const checkInDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 2 days ago (eligible)
    const checkOutDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    testBooking = await prisma.booking.create({
      data: {
        userId: adminUser.id,
        listingId: testListing.id,
        status: BookingStatus.CONFIRMED,
        startDate: checkInDate,
        endDate: checkOutDate,
        guests: 2,
        totalPrice: 100000, // 1000.00 SAR
        currency: "SAR",
        priceBreakdown: {
          basePrice: 100000,
          cleaningFee: 0,
          serviceFee: 10000, // 100.00 SAR platform commission
          currency: "SAR",
          payoutBreakdown: {
            netHostPayout: 90000, // 900.00 SAR net payout
            accommodationSubtotal: 100000,
            hostServiceFee: 10000,
            cleaningFee: 0,
            currency: "SAR",
          },
        },
      },
    });

    // Create captured payment for booking
    await prisma.bookingPayment.create({
      data: {
        bookingId: testBooking.id,
        amount: 100000,
        capturedAmount: 100000,
        status: PaymentStatus.CAPTURED,
        currency: "SAR",
        provider: "MOYASAR",
      },
    });

    await test("createOrGetBookingDistributions snapshots split rules into immutable records", async () => {
      // First save 80/20 split
      await payoutRoutingService.saveListingRoutingRules(
        hostUser.id,
        testListing.id,
        [
          {
            recipientUserId: hostUser.id,
            payoutMethodId: hostMethod.id,
            allocationPercentage: 80,
          },
          {
            recipientUserId: coHostUser.id,
            payoutMethodId: coHostMethod.id,
            allocationPercentage: 20,
          },
        ],
        { id: hostUser.id, email: hostUser.email!, role: Role.HOST },
      );

      const distributions = await payoutRoutingService.createOrGetBookingDistributions(testBooking.id);
      assert.strictEqual(distributions.length, 2);

      const hostDist = distributions.find((d) => d.recipientUserId === hostUser.id);
      const coHostDist = distributions.find((d) => d.recipientUserId === coHostUser.id);

      assert.ok(hostDist);
      assert.ok(coHostDist);
      // Net payout was 90,000 cents (900 SAR)
      assert.strictEqual(hostDist!.amountCents, 72000); // 80% of 90,000 = 72,000 cents (720.00 SAR)
      assert.strictEqual(coHostDist!.amountCents, 18000); // 20% of 90,000 = 18,000 cents (180.00 SAR)
      assert.strictEqual(hostDist!.status, "ELIGIBLE_SETTLEMENT");
    });

    await test("Subsequent routing rule changes do NOT alter committed distributions (immutability)", async () => {
      // Now change rule to 60/40
      await payoutRoutingService.saveListingRoutingRules(
        hostUser.id,
        testListing.id,
        [
          {
            recipientUserId: hostUser.id,
            payoutMethodId: hostMethod.id,
            allocationPercentage: 60,
          },
          {
            recipientUserId: coHostUser.id,
            payoutMethodId: coHostMethod.id,
            allocationPercentage: 40,
          },
        ],
        { id: hostUser.id, email: hostUser.email!, role: Role.HOST },
      );

      // Re-fetching distributions for the existing booking returns the original committed 80/20 snapshot!
      const distributions = await payoutRoutingService.createOrGetBookingDistributions(testBooking.id);
      const hostDist = distributions.find((d) => d.recipientUserId === hostUser.id);
      const coHostDist = distributions.find((d) => d.recipientUserId === coHostUser.id);

      assert.strictEqual(hostDist!.amountCents, 72000); // Still 80% (720 SAR), NOT 60%!
      assert.strictEqual(coHostDist!.amountCents, 18000); // Still 20% (180 SAR), NOT 40%!
    });

    // ───────────────────────────────────────────────────────────────────────────
    // SUITE 4: Hold & Release Synchronization
    // ───────────────────────────────────────────────────────────────────────────
    console.log("\nSuite 4: Hold & Release Synchronization");

    await test("Placing booking on hold transitions all distributions to ON_HOLD", async () => {
      await payoutService.holdPayout(
        { id: adminUser.id, email: adminUser.email!, role: Role.ADMIN },
        testBooking.id,
        {
          holdType: "DISPUTE_HOLD",
          reason: "Guest opened investigation regarding amenities",
        },
      );

      const dbDists = await prisma.bookingPayoutDistribution.findMany({
        where: { bookingId: testBooking.id },
      });

      assert.strictEqual(dbDists.length, 2);
      assert.ok(dbDists.every((d) => d.isHeld === true && d.status === "ON_HOLD"));
      assert.ok(dbDists.every((d) => d.holdType === "DISPUTE_HOLD"));
    });

    await test("Releasing hold restores distributions to ELIGIBLE_SETTLEMENT", async () => {
      await payoutService.releasePayout(
        { id: adminUser.id, email: adminUser.email!, role: Role.ADMIN },
        testBooking.id,
        {
          reason: "Dispute resolved amicably with guest",
        },
      );

      const dbDists = await prisma.bookingPayoutDistribution.findMany({
        where: { bookingId: testBooking.id },
      });

      assert.strictEqual(dbDists.length, 2);
      assert.ok(dbDists.every((d) => d.isHeld === false && d.status === "ELIGIBLE_SETTLEMENT"));
    });

    // ───────────────────────────────────────────────────────────────────────────
    // SUITE 5: SARIE Batch Export & Per-Recipient Splits
    // ───────────────────────────────────────────────────────────────────────────
    console.log("\nSuite 5: SARIE Batch Export & Per-Recipient Splits");

    let batchRef = "";

    await test("exportBatchSettlementCSV outputs split rows with decrypted unmasked IBANs", async () => {
      const csv = await payoutService.exportBatchSettlementCSV(
        { id: adminUser.id, email: adminUser.email!, role: Role.ADMIN },
        [testBooking.id],
      );

      assert.ok(csv.startsWith("Booking Reference,Beneficiary Name,Beneficiary IBAN"));

      const lines = csv.split("\n").filter(Boolean);
      // Header + 2 recipient split rows = 3 lines
      assert.strictEqual(lines.length, 3);

      // Verify Host row contains unmasked SNB IBAN
      const hostRow = lines.find((l) => l.includes("Host Phase 4"));
      assert.ok(hostRow, "Host row not found in CSV");
      assert.ok(hostRow.includes("SA09 1000 0000 0000 0000 0001"), "Decrypted SNB IBAN missing");
      assert.ok(hostRow.includes("720.00"), "Amount 720.00 SAR missing");
      assert.ok(hostRow.includes("EXPORTED"), "Status EXPORTED missing");

      // Verify Co-Host row contains unmasked Al Rajhi IBAN
      const coHostRow = lines.find((l) => l.includes("CoHost Phase 4"));
      assert.ok(coHostRow, "CoHost row not found in CSV");
      assert.ok(coHostRow.includes("SA03 8000 0000 6080 1016 7519"), "Decrypted Al Rajhi IBAN missing");
      assert.ok(coHostRow.includes("180.00"), "Amount 180.00 SAR missing");
      assert.ok(coHostRow.includes("EXPORTED"), "Status EXPORTED missing");

      // Extract batch reference from DB records
      const exportedDists = await prisma.bookingPayoutDistribution.findMany({
        where: { bookingId: testBooking.id },
      });
      assert.ok(exportedDists.every((d) => d.status === "EXPORTED" && d.batchReference));
      batchRef = exportedDists[0].batchReference!;
      assert.ok(batchRef.startsWith("SARIE_"));
    });

    // ───────────────────────────────────────────────────────────────────────────
    // SUITE 6: Batch Settlement Confirmation & Audit Trail
    // ───────────────────────────────────────────────────────────────────────────
    console.log("\nSuite 6: Batch Settlement Confirmation & Audit Trail");

    await test("Admin confirms batch settlement (PAID) transitions all records to PAID", async () => {
      const confirmResult = await payoutRoutingService.confirmBatchSettlement(
        { id: adminUser.id, email: adminUser.email!, role: Role.ADMIN },
        batchRef,
        "PAID",
      );

      assert.strictEqual(confirmResult.updatedCount, 2);
      assert.strictEqual(confirmResult.status, "PAID");

      const paidDists = await prisma.bookingPayoutDistribution.findMany({
        where: { batchReference: batchRef },
      });
      assert.ok(paidDists.every((d) => d.status === "PAID" && d.paidAt !== null));

      // Verify audit log
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          resourceType: "PAYOUT_BATCH",
          resourceId: batchRef,
          action: "BATCH_SETTLEMENT_CONFIRMED",
        },
      });
      assert.ok(auditLog, "AuditLog for batch confirmation not found");
      assert.strictEqual(auditLog!.actorId, adminUser.id);
    });

    await test("Eligible recipients endpoint returns primary host + accepted co-hosts", async () => {
      const recs = await payoutRoutingService.getListingEligibleRecipients(
        hostUser.id,
        testListing.id,
      );

      assert.strictEqual(recs.length, 2);
      const pHost = recs.find((r) => r.role === "PRIMARY_HOST");
      const cHost = recs.find((r) => r.role === "CO_HOST");

      assert.ok(pHost);
      assert.ok(cHost);
      assert.strictEqual(pHost!.verifiedPayoutMethods.length, 1);
      assert.strictEqual(cHost!.verifiedPayoutMethods.length, 1);
    });

  } finally {
    // ───────────────────────────────────────────────────────────────────────────
    // TEARDOWN: Clean up test records
    // ───────────────────────────────────────────────────────────────────────────
    console.log("\nTeardown: Cleaning up test records safely...");
    if (testBooking) {
      await prisma.bookingPayoutDistribution.deleteMany({ where: { bookingId: testBooking.id } });
      await prisma.bookingPayment.deleteMany({ where: { bookingId: testBooking.id } });
      await prisma.booking.delete({ where: { id: testBooking.id } }).catch(() => {});
    }
    if (testListing) {
      await prisma.payoutRoutingRule.deleteMany({ where: { listingId: testListing.id } });
      await prisma.listingCoHost.deleteMany({ where: { listingId: testListing.id } });
      await prisma.listing.delete({ where: { id: testListing.id } }).catch(() => {});
    }
    if (hostUser) {
      await prisma.hostPayoutMethod.deleteMany({ where: { hostId: hostUser.id } });
      await prisma.auditLog.deleteMany({ where: { actorId: hostUser.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: hostUser.id } }).catch(() => {});
    }
    if (coHostUser) {
      await prisma.hostPayoutMethod.deleteMany({ where: { hostId: coHostUser.id } });
      await prisma.auditLog.deleteMany({ where: { actorId: coHostUser.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: coHostUser.id } }).catch(() => {});
    }
    if (unauthorizedUser) {
      await prisma.user.delete({ where: { id: unauthorizedUser.id } }).catch(() => {});
    }
    if (adminUser) {
      await prisma.auditLog.deleteMany({ where: { actorId: adminUser.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: adminUser.id } }).catch(() => {});
    }
    console.log("  ✓ Teardown complete.");
  }

  console.log("\n=======================================================");
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner encountered an unhandled exception:", err);
  process.exit(1);
});
