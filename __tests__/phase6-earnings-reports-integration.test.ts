import "dotenv/config";
import assert from "node:assert";
import { prisma } from "../lib/db/prisma";
import { Role, BookingStatus, PaymentStatus, PaymentProvider } from "@/generated/prisma/enums";
import { hostReportingService } from "../services/host-reporting.service";
import { payoutService } from "../services/payout.service";

// Known valid Saudi IBANs for test bank accounts
const VALID_SNB_IBAN = "SA0910000000000000000001";
const VALID_RAJHI_IBAN = "SA0380000000608010167519";

async function runTests() {
  console.log("=== RUNNING HOMYZ PHASE 6 EARNINGS REPORTS & FINANCIAL DOCUMENTS TEST SUITE ===\n");

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
  let hostA: any = null;
  let hostB: any = null;
  let guestUser: any = null;
  let listingA1: any = null;
  let listingA2: any = null;
  let listingB: any = null;
  let bookingPaid: any = null;
  let bookingUpcoming: any = null;
  let hostRelationalMethod: any = null;

  try {
    // ───────────────────────────────────────────────────────────────────────────
    // SETUP: Create Hosts, Guest, Listings, Payout Methods, Bookings & Adjustments
    // ───────────────────────────────────────────────────────────────────────────
    console.log("Setup: Preparing test hosts, listings, relational payout methods, and ledger bookings");

    hostA = await prisma.user.create({
      data: {
        email: `host-p6-a-${timestamp}@example.com`,
        name: "Host Reporting Alpha",
        role: Role.HOST,
        personalInfo: {
          // Add a host-level adjustment (e.g., promotional bonus of 150.00 SAR = 15000 cents)
          payoutAdjustments: [
            {
              id: `adj-bonus-${timestamp}`,
              bookingId: "",
              type: "BONUS_CREDIT",
              amount: 15000,
              currency: "SAR",
              reason: "Host Superhost Bonus Incentive",
              status: "DEDUCTED", // In host reporting, DEDUCTED adjustments count toward net earnings
              createdAt: "2026-03-10T12:00:00.000Z",
              deductedAt: "2026-03-10T12:00:00.000Z",
            },
          ],
        },
      },
    });

    hostB = await prisma.user.create({
      data: {
        email: `host-p6-b-${timestamp}@example.com`,
        name: "Host Reporting Beta",
        role: Role.HOST,
      },
    });

    guestUser = await prisma.user.create({
      data: {
        email: `guest-p6-${timestamp}@example.com`,
        name: "Guest Reporting Test",
        role: Role.USER,
      },
    });

    // Relational Payout Method for Host A (Phase 3 architecture)
    hostRelationalMethod = await payoutService.addHostPayoutMethod(hostA.id, {
      accountHolderName: "Host Reporting Alpha",
      bankName: "Saudi National Bank",
      iban: VALID_SNB_IBAN,
      currency: "SAR",
      isDefault: true,
    });

    // Listing 1 for Host A
    listingA1 = await prisma.listing.create({
      data: {
        hostId: hostA.id,
        title: `Riyadh Oasis Villa ${timestamp}`,
        description: "Premier testing villa",
        price: 250000,
        city: "Riyadh",
        country: "Saudi Arabia",
        published: true,
      },
    });

    // Listing 2 for Host A (for property filter testing)
    listingA2 = await prisma.listing.create({
      data: {
        hostId: hostA.id,
        title: `Jeddah Marina Penthouse ${timestamp}`,
        description: "Waterfront luxury apartment",
        price: 180000,
        city: "Jeddah",
        country: "Saudi Arabia",
        published: true,
      },
    });

    // Listing for Host B (for cross-host isolation testing)
    listingB = await prisma.listing.create({
      data: {
        hostId: hostB.id,
        title: `Khobar Seafront Chalet ${timestamp}`,
        description: "Chalets for Host B",
        price: 120000,
        city: "Al Khobar",
        country: "Saudi Arabia",
        published: true,
      },
    });

    // Booking 1: March 2026, PAID settlement, Listing A1
    // Accommodation: 4,000 SAR (400000 cents)
    // Cleaning: 250 SAR (25000 cents)
    // Extra Guest: 100 SAR (10000 cents)
    // Pet Fee: 50 SAR (5000 cents)
    // Gross: 4,400 SAR (440000 cents)
    // Host Service Fee: 132 SAR (13200 cents) [3%]
    // Taxes Withheld: 60 SAR (6000 cents)
    // Net Host Payout: 4,268 SAR (426800 cents)
    bookingPaid = await prisma.booking.create({
      data: {
        listingId: listingA1.id,
        userId: guestUser.id,
        startDate: new Date("2026-03-01T14:00:00Z"),
        endDate: new Date("2026-03-06T11:00:00Z"), // Completed in March 2026
        guests: 3,
        totalPrice: 506000,
        currency: "SAR",
        status: BookingStatus.CONFIRMED,
        payments: {
          create: [
            {
              provider: PaymentProvider.MOYASAR,
              status: PaymentStatus.CAPTURED,
              amount: 506000,
              capturedAmount: 506000,
              currency: "SAR",
            },
          ],
        },
        priceBreakdown: {
          basePrice: 400000,
          cleaningFee: 25000,
          serviceFee: 66000,
          payoutBreakdown: {
            accommodationSubtotal: 400000,
            extraGuestFee: 10000,
            petFee: 5000,
            cleaningFee: 25000,
            hostServiceFee: 13200,
            taxesCollectedForHost: 6000,
            netHostPayout: 426800,
            currency: "SAR",
          },
          payoutExecution: {
            status: "PAID",
            settlementReference: `SETTLE-TX-${timestamp}-001`,
            amount: 426800,
            currency: "SAR",
            payoutMethodMasked: "SNB •••• 0001",
            executedAt: "2026-03-07T10:00:00.000Z",
            executedBy: "SYSTEM_SETTLEMENT",
            idempotencyKey: `IDEMP-${timestamp}-001`,
            channel: "SARIE_INSTANT",
          },
        },
      },
    });

    // Booking 2: March 2026, UPCOMING / SCHEDULED settlement, Listing A2
    // Accommodation: 1,800 SAR (180000 cents)
    // Cleaning: 150 SAR (15000 cents)
    // Extra Guest: 0
    // Pet Fee: 0
    // Gross: 1,950 SAR (195000 cents)
    // Host Service Fee: 58.50 SAR (5850 cents) [3%]
    // Taxes Withheld: 0
    // Net Host Payout: 1,891.50 SAR (189150 cents)
    bookingUpcoming = await prisma.booking.create({
      data: {
        listingId: listingA2.id,
        userId: guestUser.id,
        startDate: new Date("2026-03-20T14:00:00Z"),
        endDate: new Date("2026-03-24T11:00:00Z"), // Completed in March 2026
        guests: 2,
        totalPrice: 224250,
        currency: "SAR",
        status: BookingStatus.CONFIRMED,
        payments: {
          create: [
            {
              provider: PaymentProvider.MOYASAR,
              status: PaymentStatus.CAPTURED,
              amount: 224250,
              capturedAmount: 224250,
              currency: "SAR",
            },
          ],
        },
        priceBreakdown: {
          basePrice: 180000,
          cleaningFee: 15000,
          serviceFee: 29250,
          payoutBreakdown: {
            accommodationSubtotal: 180000,
            extraGuestFee: 0,
            petFee: 0,
            cleaningFee: 15000,
            hostServiceFee: 5850,
            taxesCollectedForHost: 0,
            netHostPayout: 189150,
            currency: "SAR",
          },
        },
      },
    });

    console.log("Setup complete.\n");

    // ===========================================================================
    // SUITE 1: Reports Landing Overview & Mathematical Reconciliation
    // ===========================================================================
    console.log("--- SUITE 1: Reports Landing Overview & Mathematical Reconciliation ---");

    await test("getReportsLanding returns comprehensive 12-month calendar dataset", async () => {
      const data = await hostReportingService.getReportsLanding(hostA.id, { year: 2026 });
      assert.ok(data, "Landing data should be returned");
      assert.strictEqual(data.selectedYear, 2026);
      assert.strictEqual(data.monthlyReports.length, 12, "Must return all 12 calendar months");
      assert.ok(data.availableYears.includes(2026), "2026 must be in available years");
      assert.strictEqual(data.listings.length, 2, "Should list host's 2 owned properties");
    });

    await test("Aggregates gross, fees, adjustments and net earnings accurately", async () => {
      const data = await hostReportingService.getReportsLanding(hostA.id, { year: 2026 });
      const summary = data.yearlySummary;

      // Expected combined March numbers:
      // Booking 1 Gross: 440000 + Booking 2 Gross: 195000 = 635000 cents
      // Platform Fee: 13200 + 5850 = 19050 cents
      // Adjustments: +15000 cents (bonus)
      // Net Earnings: 426800 + 189150 + 15000 = 630950 cents
      // Paid: 426800 cents
      // Upcoming: 189150 cents
      assert.strictEqual(summary.grossEarnings, 635000, "Gross earnings matches sum of both bookings");
      assert.strictEqual(summary.platformFee, 19050, "Platform fees matches sum of fees");
      assert.strictEqual(summary.adjustments, 15000, "Adjustments matches bonus credit");
      assert.strictEqual(summary.netEarnings, 630950, "Net earnings matches bookings net + adjustments");
      assert.strictEqual(summary.paidPayouts, 426800, "Paid disbursements matches settled booking");
      assert.strictEqual(summary.upcomingPayouts, 189150, "Upcoming disbursements matches scheduled booking");
      assert.strictEqual(summary.transactionCount, 2, "2 confirmed reservations in period");
    });

    await test("Enforces exact mathematical reconciliation formula (Gross - Fees + Adjustments === Net)", async () => {
      const data = await hostReportingService.getReportsLanding(hostA.id, { year: 2026 });
      const s = data.yearlySummary;
      const computedNet = s.grossEarnings - s.platformFee + s.adjustments;
      assert.strictEqual(
        s.netEarnings,
        computedNet,
        `Financial reconciliation check failed: Net (${s.netEarnings}) != Gross (${s.grossEarnings}) - Fees (${s.platformFee}) + Adjustments (${s.adjustments})`,
      );
    });

    await test("Marks March as IN_PROGRESS or COMPLETED and empty months as NO_ACTIVITY", async () => {
      const data = await hostReportingService.getReportsLanding(hostA.id, { year: 2026 });
      const march = data.monthlyReports.find((m) => m.month === 3);
      assert.ok(march, "March month card exists");
      assert.ok(
        march.status === "COMPLETED" || march.status === "IN_PROGRESS",
        `March status should be COMPLETED or IN_PROGRESS, got ${march.status}`,
      );
      assert.strictEqual(march.transactionCount, 2);

      const january = data.monthlyReports.find((m) => m.month === 1);
      assert.ok(january, "January month card exists");
      assert.strictEqual(january.status, "NO_ACTIVITY", "January has no reservations");
      assert.strictEqual(january.netEarnings, 0);
    });

    // ===========================================================================
    // SUITE 2: Monthly & Yearly Reporting Deep Dive
    // ===========================================================================
    console.log("\n--- SUITE 2: Monthly & Yearly Reporting Deep Dive ---");

    await test("getMonthlyReport returns itemized reservation rows and breakdown categories", async () => {
      const monthly = await hostReportingService.getMonthlyReport(hostA.id, 2026, 3);
      assert.ok(monthly, "Monthly report returned");
      assert.strictEqual(monthly.month, 3);
      assert.strictEqual(monthly.year, 2026);
      assert.strictEqual(monthly.transactions.length, 2, "Itemizes both March reservations");

      const paidRow = monthly.transactions.find((r) => r.bookingId === bookingPaid.id);
      assert.ok(paidRow, "Paid booking row found in monthly report");
      assert.strictEqual(paidRow.grossEarnings, 440000);
      assert.strictEqual(paidRow.netPayout, 426800);
      assert.strictEqual(paidRow.status, "PAID");

      const upcomingRow = monthly.transactions.find((r) => r.bookingId === bookingUpcoming.id);
      assert.ok(upcomingRow, "Upcoming booking row found in monthly report");
      assert.strictEqual(upcomingRow.grossEarnings, 195000);
      assert.strictEqual(upcomingRow.netPayout, 189150);
      assert.ok(["SCHEDULED", "PROCESSING", "ELIGIBLE_SETTLEMENT"].includes(upcomingRow.status));
    });

    await test("getYearlyReport consolidates 12 months with annual totals", async () => {
      const yearly = await hostReportingService.getYearlyReport(hostA.id, 2026);
      assert.ok(yearly, "Yearly report returned");
      assert.strictEqual(yearly.year, 2026);
      assert.strictEqual(yearly.monthlyBreakdown.length, 12, "Contains 12 monthly aggregations");
      assert.strictEqual(yearly.summary.grossEarnings, 635000);
      assert.strictEqual(yearly.summary.netEarnings, 630950);
      assert.strictEqual(yearly.summary.paidPayouts, 426800);
    });

    await test("Attribution follows stay completion date (b.endDate) per ZATCA / STR standards", async () => {
      // Booking checkIn is 2026-03-01, checkOut is 2026-03-06
      const marchReport = await hostReportingService.getMonthlyReport(hostA.id, 2026, 3);
      const febReport = await hostReportingService.getMonthlyReport(hostA.id, 2026, 2);

      const inMarch = marchReport.transactions.some((r) => r.bookingId === bookingPaid.id);
      const inFeb = febReport.transactions.some((r) => r.bookingId === bookingPaid.id);

      assert.strictEqual(inMarch, true, "Revenue recognized in checkOut month (March)");
      assert.strictEqual(inFeb, false, "Revenue not recognized prior to completion (February)");
    });

    // ===========================================================================
    // SUITE 3: Filtering & Multi-Currency Isolation
    // ===========================================================================
    console.log("\n--- SUITE 3: Filtering & Multi-Currency Isolation ---");

    await test("Filters report data exclusively to selected property (listingId)", async () => {
      const filtered = await hostReportingService.getReportsLanding(hostA.id, {
        year: 2026,
        listingId: listingA1.id,
      });

      assert.strictEqual(filtered.selectedListingId, listingA1.id);
      assert.strictEqual(filtered.yearlySummary.transactionCount, 1, "Only 1 booking for listing A1");
      assert.strictEqual(filtered.yearlySummary.grossEarnings, 440000, "Gross earnings strictly from listing A1");
      assert.strictEqual(filtered.yearlySummary.paidPayouts, 426800);
    });

    await test("Rejects unauthorized listingId for Host A (cross-host property filter)", async () => {
      let threw = false;
      try {
        await hostReportingService.getReportsLanding(hostA.id, {
          year: 2026,
          listingId: listingB.id, // Owned by Host B
        });
      } catch (err: any) {
        threw = true;
        assert.ok(err.statusCode === 404 || err.message.includes("Listing"), "Forbidden or not found error");
      }
      assert.strictEqual(threw, true, "Must throw when attempting to filter by another host's listing");
    });

    await test("Preserves currency isolation (SAR by default) and handles explicit currency parameter", async () => {
      const sarLanding = await hostReportingService.getReportsLanding(hostA.id, {
        year: 2026,
        currency: "SAR",
      });
      assert.strictEqual(sarLanding.selectedCurrency, "SAR");
      assert.strictEqual(sarLanding.yearlySummary.currency, "SAR");
    });

    // ===========================================================================
    // SUITE 4: CSV & PDF Export Generation & Sanitization
    // ===========================================================================
    console.log("\n--- SUITE 4: CSV & PDF Export Generation & Sanitization ---");

    await test("exportCsv generates RFC-4180 compliant CSV with UTF-8 BOM and metadata header", async () => {
      const { csv, filename } = await hostReportingService.exportCsv(hostA.id, {
        period: "custom",
        startDate: "2026-03-01",
        endDate: "2026-03-31",
        currency: "SAR",
      });

      assert.ok(csv.startsWith("\uFEFF"), "CSV must include UTF-8 Byte Order Mark (BOM)");
      assert.ok(csv.includes("# Homyz Host Earnings Report"), "Contains metadata header");
      assert.ok(csv.includes("# Currency: SAR"), "Metadata includes currency");
      assert.ok(csv.includes("Booking Reference"), "Contains column header");
      assert.ok(csv.includes(bookingPaid.id), "Includes bookingPaid reference");
      assert.ok(filename.endsWith(".csv"), "Filename ends in .csv");
    });

    await test("exportCsv sanitizes spreadsheet formulas against injection attacks", async () => {
      // Create a temporary booking with formula-like injection string in guest name / title
      const maliciousListing = await prisma.listing.create({
        data: {
          hostId: hostA.id,
          title: "=cmd|' /C calc'!A0",
          description: "Malicious title injection test",
          price: 100000,
          city: "Riyadh",
          country: "Saudi Arabia",
        },
      });

      const maliciousBooking = await prisma.booking.create({
        data: {
          listingId: maliciousListing.id,
          userId: guestUser.id,
          startDate: new Date("2026-03-10T14:00:00Z"),
          endDate: new Date("2026-03-12T11:00:00Z"),
          guests: 1,
          totalPrice: 115000,
          currency: "SAR",
          status: BookingStatus.CONFIRMED,
          payments: {
            create: [
              {
                provider: PaymentProvider.MOYASAR,
                status: PaymentStatus.CAPTURED,
                amount: 115000,
                capturedAmount: 115000,
                currency: "SAR",
              },
            ],
          },
          priceBreakdown: {
            basePrice: 100000,
            cleaningFee: 0,
            serviceFee: 15000,
            payoutBreakdown: {
              accommodationSubtotal: 100000,
              extraGuestFee: 0,
              petFee: 0,
              cleaningFee: 0,
              hostServiceFee: 3000,
              taxesCollectedForHost: 0,
              netHostPayout: 97000,
              currency: "SAR",
            },
          },
        },
      });

      try {
        const { csv } = await hostReportingService.exportCsv(hostA.id, {
          period: "custom",
          startDate: "2026-03-01",
          endDate: "2026-03-31",
          listingId: maliciousListing.id,
          currency: "SAR",
        });

        // The formula =cmd... must be safely escaped with leading single quote: "'=cmd"
        assert.ok(
          csv.includes("''=cmd") || csv.includes("'=cmd"),
          "Dangerous leading formula character must be sanitized with prepended single quote",
        );
      } finally {
        if (maliciousBooking) {
          await prisma.bookingPayment.deleteMany({ where: { bookingId: maliciousBooking.id } }).catch(() => {});
          await prisma.booking.delete({ where: { id: maliciousBooking.id } }).catch(() => {});
        }
        if (maliciousListing) {
          await prisma.listing.delete({ where: { id: maliciousListing.id } }).catch(() => {});
        }
      }
    });

    await test("exportPdf generates valid binary PDF buffer with %PDF- header", async () => {
      const { buffer, filename } = await hostReportingService.exportPdf(hostA.id, {
        period: "custom",
        startDate: "2026-03-01",
        endDate: "2026-03-31",
        currency: "SAR",
      });

      assert.ok(Buffer.isBuffer(buffer), "Must return Node.js Buffer");
      assert.ok(buffer.length > 500, `PDF buffer length should be substantial, got ${buffer.length} bytes`);
      const magicBytes = buffer.subarray(0, 5).toString("utf-8");
      assert.strictEqual(magicBytes, "%PDF-", `Expected %PDF- magic bytes, got ${magicBytes}`);
      assert.ok(filename.endsWith(".pdf"), "Filename ends in .pdf");
    });

    // ===========================================================================
    // SUITE 5: Dual-Read Relational Fallback & Payout Method Resolution
    // ===========================================================================
    console.log("\n--- SUITE 5: Dual-Read Relational Fallback & Payout Method Resolution ---");

    await test("Resolves Phase 3 relational HostPayoutMethod records seamlessly", async () => {
      // Host A's method is stored in relational HostPayoutMethod table (hostRelationalMethod)
      // Confirm that getReportsLanding accesses it without requiring personalInfo.payoutMethods
      const methods = await payoutService.getHostPayoutMethods(hostA.id);
      assert.ok(methods.length > 0, "Relational method exists");
      assert.strictEqual(methods[0].bankName, "Saudi National Bank");

      const landing = await hostReportingService.getReportsLanding(hostA.id, { year: 2026 });
      assert.ok(landing, "Landing retrieved without error when using relational payout methods");
    });

    await test("Distinguishes paid disbursements from scheduled / upcoming disbursements", async () => {
      const landing = await hostReportingService.getReportsLanding(hostA.id, { year: 2026 });
      const summary = landing.yearlySummary;

      assert.strictEqual(summary.paidPayouts, 426800, "Paid matches bookingPaid");
      assert.strictEqual(summary.upcomingPayouts, 189150, "Upcoming matches bookingUpcoming");
      assert.ok(summary.paidPayouts > 0 && summary.upcomingPayouts > 0);
    });

    // ===========================================================================
    // SUITE 6: Security & Cross-Host Authorization Boundaries
    // ===========================================================================
    console.log("\n--- SUITE 6: Security & Cross-Host Authorization Boundaries ---");

    await test("Host B cannot view or aggregate Host A's earnings reports", async () => {
      const bLanding = await hostReportingService.getReportsLanding(hostB.id, { year: 2026 });
      // Host B has no bookings on listingB
      assert.strictEqual(bLanding.yearlySummary.grossEarnings, 0);
      assert.strictEqual(bLanding.yearlySummary.netEarnings, 0);
      assert.strictEqual(bLanding.yearlySummary.transactionCount, 0);
      assert.strictEqual(bLanding.yearlySummary.paidPayouts, 0);
    });

    await test("Throws 404 for non-existent host ID", async () => {
      let threw = false;
      try {
        await hostReportingService.getReportsLanding("non-existent-host-uuid", { year: 2026 });
      } catch (err: any) {
        threw = true;
        assert.ok(err.statusCode === 404 || err.message.includes("not found"));
      }
      assert.strictEqual(threw, true, "Must throw 404 when host is not found");
    });
  } finally {
    // ───────────────────────────────────────────────────────────────────────────
    // TEARDOWN: Clean up all created test entities
    // ───────────────────────────────────────────────────────────────────────────
    console.log("\nTeardown: Cleaning up test bookings, listings, payout methods, and users...");

    if (bookingPaid) {
      await prisma.bookingPayment.deleteMany({ where: { bookingId: bookingPaid.id } }).catch(() => {});
      await prisma.booking.delete({ where: { id: bookingPaid.id } }).catch(() => {});
    }
    if (bookingUpcoming) {
      await prisma.bookingPayment.deleteMany({ where: { bookingId: bookingUpcoming.id } }).catch(() => {});
      await prisma.booking.delete({ where: { id: bookingUpcoming.id } }).catch(() => {});
    }

    if (listingA1) {
      await prisma.listing.delete({ where: { id: listingA1.id } }).catch(() => {});
    }
    if (listingA2) {
      await prisma.listing.delete({ where: { id: listingA2.id } }).catch(() => {});
    }
    if (listingB) {
      await prisma.listing.delete({ where: { id: listingB.id } }).catch(() => {});
    }

    if (hostRelationalMethod) {
      await prisma.hostPayoutMethod.delete({ where: { id: hostRelationalMethod.id } }).catch(() => {});
    }

    if (guestUser) {
      await prisma.user.delete({ where: { id: guestUser.id } }).catch(() => {});
    }
    if (hostA) {
      await prisma.user.delete({ where: { id: hostA.id } }).catch(() => {});
    }
    if (hostB) {
      await prisma.user.delete({ where: { id: hostB.id } }).catch(() => {});
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
