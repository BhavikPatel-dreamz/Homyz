import "dotenv/config";
import assert from "node:assert";
import { prisma } from "../lib/db/prisma";
import {
  Role,
  TaxpayerType,
  TaxpayerVerificationStatus,
  HostTaxDocumentType,
  TaxRegistrationStatus,
  BookingStatus,
} from "@/generated/prisma/enums";
import { hostTaxService } from "../services/host-tax.service";
import {
  validateSaudiTaxIdentifier,
  validateSaudiVatNumber,
  maskTaxIdentifier,
} from "../lib/validation/tax";
import { decryptAccountIdentifier } from "../lib/security/payout-encryption";

async function runTests() {
  console.log("=== RUNNING HOMYZ PHASE 5 TAXPAYER, VAT & TAX DOCUMENTS TEST SUITE ===\n");

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
  let adminActor: any = null;
  let hostActorA: any = null;
  let hostActorB: any = null;
  let testListing: any = null;
  let testBooking: any = null;
  let testGuest: any = null;

  try {
    // ───────────────────────────────────────────────────────────────────────────
    // SETUP: Create Test Entities in Database
    // ───────────────────────────────────────────────────────────────────────────
    console.log("Setup: Preparing test users (Admin, Host A, Host B, Guest), listing and booking");

    adminActor = await prisma.user.create({
      data: {
        email: `admin-p5-${timestamp}@example.com`,
        name: "Admin Phase 5",
        role: Role.ADMIN,
      },
    });

    hostActorA = await prisma.user.create({
      data: {
        email: `host-a-p5-${timestamp}@example.com`,
        name: "Host Alpha",
        role: Role.HOST,
      },
    });

    hostActorB = await prisma.user.create({
      data: {
        email: `host-b-p5-${timestamp}@example.com`,
        name: "Host Beta",
        role: Role.HOST,
      },
    });

    testGuest = await prisma.user.create({
      data: {
        email: `guest-p5-${timestamp}@example.com`,
        name: "Guest Phase 5",
        role: Role.USER,
      },
    });

    testListing = await prisma.listing.create({
      data: {
        hostId: hostActorA.id,
        title: `Riyadh Luxury Villa ${timestamp}`,
        description: "A luxury villa in Riyadh for tax test suite",
        price: 100000, // 1,000 SAR
        city: "Riyadh",
        country: "Saudi Arabia",
        published: true,
      },
    });

    testBooking = await prisma.booking.create({
      data: {
        listingId: testListing.id,
        userId: testGuest.id,
        startDate: new Date("2026-03-01T15:00:00Z"),
        endDate: new Date("2026-03-05T11:00:00Z"),
        guests: 2,
        totalPrice: 475000, // 4,750 SAR in cents
        currency: "SAR",
        status: BookingStatus.CONFIRMED,
        priceBreakdown: {
          cleaningFee: 15000,
          serviceFee: 60000,
          taxes: [
            {
              name: "Saudi VAT",
              rate: 0.15,
              amount: 60000,
            },
            {
              name: "Municipality Tourism Fee",
              rate: 0.05,
              amount: 20000,
            },
          ],
          totalTax: 80000,
          totalAmount: 475000,
        },
      },
    });

    console.log("Setup complete.\n");

    // ===========================================================================
    // SUITE 1: Taxpayer Identification & Validation Tests
    // ===========================================================================
    console.log("--- SUITE 1: Taxpayer Identification & Validation Tests ---");

    await test("Validates Saudi National ID (10 digits starting with 1)", () => {
      const result = validateSaudiTaxIdentifier("NIN", "1087654321");
      assert.strictEqual(result.valid, true);
    });

    await test("Rejects invalid Saudi National ID (wrong prefix or non-10 digits)", () => {
      const wrongPrefix = validateSaudiTaxIdentifier("NIN", "2087654321");
      assert.strictEqual(wrongPrefix.valid, false);
      assert.ok(wrongPrefix.error?.includes("starting with 1"));

      const wrongLen = validateSaudiTaxIdentifier("NIN", "108765432");
      assert.strictEqual(wrongLen.valid, false);
      assert.ok(wrongLen.error?.includes("10 digits"));
    });

    await test("Validates Saudi Iqama (10 digits starting with 2)", () => {
      const result = validateSaudiTaxIdentifier("IQAMA", "2187654321");
      assert.strictEqual(result.valid, true);
    });

    await test("Rejects invalid Saudi Iqama (wrong prefix or length)", () => {
      const wrongPrefix = validateSaudiTaxIdentifier("IQAMA", "1187654321");
      assert.strictEqual(wrongPrefix.valid, false);
      assert.ok(wrongPrefix.error?.includes("starting with 2"));
    });

    await test("Validates Saudi TIN (10 digits starting with 3)", () => {
      const result = validateSaudiTaxIdentifier("TIN", "3087654321");
      assert.strictEqual(result.valid, true);
    });

    await test("Validates Saudi Commercial Registration (CR, 10 digits)", () => {
      const result = validateSaudiTaxIdentifier("CR", "1010765432");
      assert.strictEqual(result.valid, true);
    });

    await test("Rejects non-numeric characters in Saudi tax identifiers", () => {
      const result = validateSaudiTaxIdentifier("CR", "101076543A");
      assert.strictEqual(result.valid, false);
      assert.ok(result.error?.includes("10 digits"));
    });

    await test("Masks tax identifier correctly preserving only last 4 digits", () => {
      const masked10 = maskTaxIdentifier("1087654321");
      assert.strictEqual(masked10, "••••••4321");

      const masked15 = maskTaxIdentifier("300123456700003");
      assert.strictEqual(masked15, "•••••••••••0003");
    });

    // ===========================================================================
    // SUITE 2: VAT/GST Validation & Distinction Tests
    // ===========================================================================
    console.log("\n--- SUITE 2: VAT/GST Validation & Distinction Tests ---");

    await test("Validates Saudi 15-digit VAT number (starts and ends with 3)", () => {
      const result = validateSaudiVatNumber("300123456700003");
      assert.strictEqual(result.valid, true);
    });

    await test("Explicitly detects and rejects 10-digit TIN entered in VAT field", () => {
      const result = validateSaudiVatNumber("3001234567");
      assert.strictEqual(result.valid, false);
      assert.ok(result.error?.includes("10-digit Tax Identification Number (TIN)"));
      assert.ok(result.error?.includes("15 digits"));
    });

    await test("Rejects 15-digit number not starting or ending with 3", () => {
      const wrongStart = validateSaudiVatNumber("100123456700003");
      assert.strictEqual(wrongStart.valid, false);
      assert.ok(wrongStart.error?.includes("start with digit 3"));

      const wrongEnd = validateSaudiVatNumber("300123456700009");
      assert.strictEqual(wrongEnd.valid, false);
      assert.ok(wrongEnd.error?.includes("end with digit 3"));
    });

    await test("Permits non-VAT-registered host flag without requiring VAT number", async () => {
      // Host A indicates non-VAT registered
      const result = await hostTaxService.saveHostVatRegistration(hostActorA, {
        isVatRegistered: false,
        countryCode: "SA",
      });
      assert.strictEqual((result as any).isVatRegistered, false);
    });

    // SUITE 3: Database Persistence & Encryption Tests
    // ===========================================================================
    console.log("\n--- SUITE 3: Database Persistence & Encryption Tests ---");

    let savedProfileA: any = null;

    await test("Saves Individual taxpayer profile with AES-256-GCM encryption", async () => {
      savedProfileA = await hostTaxService.saveHostTaxpayerProfile(hostActorA, {
        taxpayerType: "INDIVIDUAL",
        legalName: "Ahmed Al-Saud",
        countryCode: "SA",
        taxIdentifierType: "NIN",
        taxIdentifier: "1098765432",
        addressLine1: "Olaya Street, Building 42",
        city: "Riyadh",
        postalCode: "12211",
      });

      assert.ok(savedProfileA.id);
      assert.strictEqual(savedProfileA.legalName, "Ahmed Al-Saud");
      assert.strictEqual(savedProfileA.taxpayerType, "INDIVIDUAL");
      assert.strictEqual(savedProfileA.status, "PENDING_VERIFICATION");
      assert.strictEqual(savedProfileA.maskedTaxIdentifier, "••••••5432");
      assert.strictEqual(savedProfileA.taxIdentifierLast4, "5432");
      // Verify raw tax identifier is NEVER exposed on the DTO
      assert.strictEqual((savedProfileA as any).taxIdentifier, undefined);
      assert.strictEqual((savedProfileA as any).encryptedTaxIdentifier, undefined);
    });

    await test("Verifies raw ciphertext in database decrypts back to original identifier", async () => {
      const rawInDb = await prisma.hostTaxpayerProfile.findUnique({
        where: { id: savedProfileA.id },
      });
      assert.ok(rawInDb);
      assert.notStrictEqual(rawInDb.encryptedTaxIdentifier, "1098765432");
      assert.ok(rawInDb.encryptedTaxIdentifier.includes(":")); // iv:ciphertext:authTag

      const decrypted = decryptAccountIdentifier(rawInDb.encryptedTaxIdentifier);
      assert.strictEqual(decrypted, "1098765432");
    });

    await test("Updates taxpayer profile and resets status to PENDING_VERIFICATION", async () => {
      // First artificially set status to VERIFIED
      await prisma.hostTaxpayerProfile.update({
        where: { id: savedProfileA.id },
        data: { status: TaxpayerVerificationStatus.VERIFIED },
      });

      const updated = await hostTaxService.saveHostTaxpayerProfile(hostActorA, {
        taxpayerType: "INDIVIDUAL",
        legalName: "Ahmed M. Al-Saud",
        countryCode: "SA",
        taxIdentifierType: "NIN",
        taxIdentifier: "1098765432",
        addressLine1: "King Fahd Road, Tower 5",
        city: "Riyadh",
        postalCode: "12212",
      });

      assert.strictEqual(updated.legalName, "Ahmed M. Al-Saud");
      assert.strictEqual(updated.status, "PENDING_VERIFICATION");
      assert.strictEqual(updated.addressLine1, "King Fahd Road, Tower 5");
    });

    await test("Saves Business taxpayer profile with CR and company details", async () => {
      const bizProfile = await hostTaxService.saveHostTaxpayerProfile(hostActorB, {
        taxpayerType: "BUSINESS",
        legalName: "Red Sands Hospitality Co.",
        businessName: "Red Sands Villas",
        businessRegistrationNumber: "1010998877",
        countryCode: "SA",
        taxIdentifierType: "CR",
        taxIdentifier: "1010998877",
        addressLine1: "King Abdullah Financial District",
        city: "Riyadh",
        postalCode: "13511",
      });

      assert.ok(bizProfile.id);
      assert.strictEqual(bizProfile.taxpayerType, "BUSINESS");
      assert.strictEqual(bizProfile.businessName, "Red Sands Villas");
      assert.strictEqual(bizProfile.businessRegistrationNumber, "1010998877");
      assert.strictEqual(bizProfile.maskedTaxIdentifier, "••••••8877");
    });

    await test("Rejects cross-host profile access (Host B cannot read or write Host A profile)", async () => {
      // Host B tries to get Host A's profile
      await assert.rejects(
        async () => {
          await hostTaxService.getHostTaxpayerProfile(hostActorB, hostActorA.id);
        },
        /not authorized/i,
      );

      // Host B tries to save Host A's profile
      await assert.rejects(
        async () => {
          await hostTaxService.saveHostTaxpayerProfile(
            hostActorB,
            {
              taxpayerType: "INDIVIDUAL",
              legalName: "Intruder",
              countryCode: "SA",
              taxIdentifierType: "NIN",
              taxIdentifier: "1012345678",
            },
            hostActorA.id,
          );
        },
        /not authorized/i,
      );
    });

    // ===========================================================================
    // SUITE 4: VAT Registration & Duplicate Prevention Tests
    // ===========================================================================
    console.log("\n--- SUITE 4: VAT Registration & Duplicate Prevention Tests ---");

    let savedVatA: any = null;

    await test("Saves 15-digit ZATCA VAT registration for Host A", async () => {
      savedVatA = await hostTaxService.saveHostVatRegistration(hostActorA, {
        isVatRegistered: true,
        vatNumber: "300123456700003",
        businessName: "Al-Saud Hospitality Properties",
        countryCode: "SA",
      });

      assert.ok(savedVatA.id);
      assert.strictEqual(savedVatA.status, "PENDING_VERIFICATION");
      assert.strictEqual(savedVatA.registrationNumberMasked, "•••••••••••0003");
      assert.strictEqual(savedVatA.businessName, "Al-Saud Hospitality Properties");
    });

    await test("Rejects duplicate VAT registration across distinct hosts", async () => {
      // Host B tries to register Host A's identical 15-digit VAT number
      await assert.rejects(
        async () => {
          await hostTaxService.saveHostVatRegistration(hostActorB, {
            isVatRegistered: true,
            vatNumber: "300123456700003",
            businessName: "Another Company",
            countryCode: "SA",
          });
        },
        /already registered to another host/i,
      );
    });

    // ===========================================================================
    // SUITE 5: Tax Documents & PDF Generation Tests
    // ===========================================================================
    console.log("\n--- SUITE 5: Tax Documents & PDF Generation Tests ---");

    let generatedAnnualSummary: any = null;

    await test("Generates Annual Tax Summary for 2026 completed bookings", async () => {
      const summaryResult = await hostTaxService.generateAnnualTaxSummary(hostActorA, 2026);
      assert.ok(summaryResult.document);
      assert.ok(summaryResult.pdfBuffer);
      assert.ok(summaryResult.pdfBuffer.length > 0);

      // Verify PDF header magic bytes '%PDF-'
      const pdfHeader = summaryResult.pdfBuffer.subarray(0, 5).toString("utf-8");
      assert.strictEqual(pdfHeader, "%PDF-");

      generatedAnnualSummary = summaryResult.document;
      assert.strictEqual(generatedAnnualSummary.taxYear, 2026);
      assert.strictEqual(generatedAnnualSummary.documentType, "ANNUAL_TAX_SUMMARY");
      assert.strictEqual(generatedAnnualSummary.fileFormat.toLowerCase(), "pdf");
      assert.strictEqual(generatedAnnualSummary.status, "READY");
    });

    await test("Generates Reservation Tax Invoice PDF for completed booking", async () => {
      const invoiceResult = await hostTaxService.generateReservationTaxInvoicePdf(
        hostActorA,
        testBooking.id,
      );
      assert.ok(invoiceResult.buffer);
      assert.ok(invoiceResult.buffer.length > 0);

      // Verify PDF header magic bytes '%PDF-'
      const pdfHeader = invoiceResult.buffer.subarray(0, 5).toString("utf-8");
      assert.strictEqual(pdfHeader, "%PDF-");

      // Verify document was recorded in HostTaxDocument repository
      const docs = await hostTaxService.getHostTaxDocuments(hostActorA, {
        documentType: "BOOKING_TAX_INVOICE",
      });
      const invoiceDoc = docs.find((d) => d.bookingId === testBooking.id);
      assert.ok(invoiceDoc);
      assert.strictEqual(invoiceDoc.documentType, "BOOKING_TAX_INVOICE");
    });

    await test("Downloads generated tax document with proper filename and authorization", async () => {
      const downloadResult = await hostTaxService.downloadTaxDocument(
        hostActorA,
        generatedAnnualSummary.id,
      );
      assert.ok(downloadResult.buffer);
      assert.strictEqual(downloadResult.contentType, "application/pdf");
      assert.ok(downloadResult.filename.endsWith(".pdf"));
      assert.ok(
        downloadResult.filename.includes("Annual_Tax_Summary") ||
          downloadResult.filename.includes("2026"),
      );
    });

    await test("Rejects unauthorized tax document download (Host B cannot download Host A document)", async () => {
      await assert.rejects(
        async () => {
          await hostTaxService.downloadTaxDocument(hostActorB, generatedAnnualSummary.id);
        },
        /not authorized|not found/i,
      );
    });

    // ===========================================================================
    // SUITE 6: Admin Verification & Audit Logging Tests
    // ===========================================================================
    console.log("\n--- SUITE 6: Admin Verification & Audit Logging Tests ---");

    await test("Admin verifies host taxpayer profile and writes audit log", async () => {
      const verified = await hostTaxService.verifyTaxpayerProfile(
        adminActor,
        savedProfileA.id,
        {
          status: "VERIFIED",
          notes: "National identity card verified against Saudi government registry",
        },
      );

      assert.strictEqual(verified.status, "VERIFIED");
      assert.ok(verified.verifiedAt);

      // Verify audit log
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          resourceType: "TAXPAYER_PROFILE",
          resourceId: savedProfileA.id,
          action: "ADMIN_VERIFY_TAXPAYER_PROFILE",
        },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(auditLog);
      assert.strictEqual(auditLog.actorId, adminActor.id);
    });

    await test("Admin rejects taxpayer profile with mandatory rejection reason", async () => {
      // Missing rejection reason throws error
      await assert.rejects(
        async () => {
          await hostTaxService.verifyTaxpayerProfile(
            adminActor,
            savedProfileA.id,
            { status: "REJECTED" },
          );
        },
        /rejection reason is mandatory|rejection reason is required/i,
      );

      const rejected = await hostTaxService.verifyTaxpayerProfile(
        adminActor,
        savedProfileA.id,
        {
          status: "REJECTED",
          rejectionReason: "Address on National ID does not match property listing locality.",
        },
      );

      assert.strictEqual(rejected.status, "REJECTED");
      assert.strictEqual(
        rejected.rejectionReason,
        "Address on National ID does not match property listing locality.",
      );
    });

    await test("Admin verifies host VAT registration and writes audit log", async () => {
      const verifiedVat = await hostTaxService.verifyTaxRegistration(
        adminActor,
        savedVatA.id,
        {
          status: "VERIFIED",
          notes: "ZATCA 15-digit VAT certificate confirmed on official portal",
        },
      );

      assert.strictEqual(verifiedVat.status, "VERIFIED");
      assert.ok(verifiedVat.verifiedAt);

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          resourceType: "TAX_REGISTRATION",
          resourceId: savedVatA.id,
          action: "ADMIN_VERIFY_TAX_REGISTRATION",
        },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(auditLog);
      assert.strictEqual(auditLog.actorId, adminActor.id);
    });

    await test("Non-admin user cannot verify taxpayer profile or tax registration", async () => {
      await assert.rejects(
        async () => {
          await hostTaxService.verifyTaxpayerProfile(
            hostActorA,
            savedProfileA.id,
            { status: "VERIFIED" },
          );
        },
        /forbidden|not authorized|permission/i,
      );

      await assert.rejects(
        async () => {
          await hostTaxService.verifyTaxRegistration(
            hostActorA,
            savedVatA.id,
            { status: "VERIFIED" },
          );
        },
        /forbidden|not authorized|permission/i,
      );
    });

  } finally {
    // ───────────────────────────────────────────────────────────────────────────
    // TEARDOWN: Clean up test records
    // ───────────────────────────────────────────────────────────────────────────
    console.log("\nTeardown: Cleaning up test records safely...");

    if (testBooking) {
      await prisma.hostTaxDocument.deleteMany({ where: { bookingId: testBooking.id } });
      await prisma.booking.delete({ where: { id: testBooking.id } }).catch(() => {});
    }

    if (testListing) {
      await prisma.listing.delete({ where: { id: testListing.id } }).catch(() => {});
    }

    if (hostActorA) {
      await prisma.hostTaxDocument.deleteMany({ where: { hostId: hostActorA.id } });
      await prisma.taxRegistration.deleteMany({ where: { hostId: hostActorA.id } });
      await prisma.hostTaxpayerProfile.deleteMany({ where: { hostId: hostActorA.id } });
      await prisma.auditLog.deleteMany({ where: { actorId: hostActorA.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: hostActorA.id } }).catch(() => {});
    }

    if (hostActorB) {
      await prisma.hostTaxDocument.deleteMany({ where: { hostId: hostActorB.id } });
      await prisma.taxRegistration.deleteMany({ where: { hostId: hostActorB.id } });
      await prisma.hostTaxpayerProfile.deleteMany({ where: { hostId: hostActorB.id } });
      await prisma.auditLog.deleteMany({ where: { actorId: hostActorB.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: hostActorB.id } }).catch(() => {});
    }

    if (testGuest) {
      await prisma.user.delete({ where: { id: testGuest.id } }).catch(() => {});
    }

    if (adminActor) {
      await prisma.auditLog.deleteMany({ where: { actorId: adminActor.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: adminActor.id } }).catch(() => {});
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
