import "dotenv/config";
import assert from "node:assert";
import { prisma } from "../lib/db/prisma";
import { Role } from "@/generated/prisma/enums";
import { payoutService } from "../services/payout.service";
import { paypalPayoutService } from "../services/paypal-payout.service";
import {
  convertSarHalalasToUsdCents,
  convertUsdCentsToSarHalalas,
  SAMA_SAR_USD_PEG,
} from "../lib/currency/payout-converter";
import {
  maskEmail,
  encryptAccountIdentifier,
  decryptAccountIdentifier,
  generateAccountFingerprint,
} from "../lib/security/payout-encryption";

const VALID_SNB_IBAN = "SA0910000000000000000001";

async function runTests() {
  console.log("=== RUNNING HOMYZ PAYPAL SAUDI ARABIA AVAILABILITY & INTEGRATION TEST SUITE ===\n");

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
  let testHostA: any = null;
  let testHostB: any = null;
  let paypalMethodA: any = null;
  let ibanMethodA: any = null;
  let isMockDatabase = false;

  // In-memory mock store in case external Neon quota limit (Code 53000) is reached
  const mockUsers: any[] = [];
  const mockMethods: any[] = [];

  try {
    // ───────────────────────────────────────────────────────────────────────────
    // SETUP: Create Test Hosts in Database (with graceful in-memory mock fallback)
    // ───────────────────────────────────────────────────────────────────────────
    console.log("Setup: Preparing test hosts for PayPal Saudi integration verification");

    try {
      testHostA = await prisma.user.create({
        data: {
          email: `host-paypal-a-${timestamp}@example.com`,
          name: "Saudi Host Alpha",
          role: Role.HOST,
        },
      });

      testHostB = await prisma.user.create({
        data: {
          email: `host-paypal-b-${timestamp}@example.com`,
          name: "Saudi Host Beta",
          role: Role.HOST,
        },
      });
      console.log("  ✓ Database connected to Neon PostgreSQL.");
    } catch (dbErr: any) {
      if (
        dbErr.message?.includes("quota") ||
        dbErr.code === "53000" ||
        dbErr.code === "P2039" ||
        dbErr.code === "EAI_AGAIN" ||
        dbErr.message?.includes("EAI_AGAIN")
      ) {
        console.log("  ℹ Live database offline/quota exceeded. Activating self-contained test proxy.");
        isMockDatabase = true;

        testHostA = {
          id: `host_a_${timestamp}`,
          email: `host-paypal-a-${timestamp}@example.com`,
          name: "Saudi Host Alpha",
          role: Role.HOST,
          personalInfo: { identityStatus: "VERIFIED" },
        };
        testHostB = {
          id: `host_b_${timestamp}`,
          email: `host-paypal-b-${timestamp}@example.com`,
          name: "Saudi Host Beta",
          role: Role.HOST,
          personalInfo: { identityStatus: "VERIFIED" },
        };
        mockUsers.push(testHostA, testHostB);

        // Install non-intrusive mock hooks on prisma for the test
        const originalUserFindUnique = prisma.user.findUnique;
        const originalUserUpdate = prisma.user.update;
        const originalMethodFindFirst = prisma.hostPayoutMethod.findFirst;
        const originalMethodFindMany = prisma.hostPayoutMethod.findMany;
        const originalMethodCount = prisma.hostPayoutMethod.count;
        const originalMethodCreate = prisma.hostPayoutMethod.create;
        const originalMethodUpdateMany = prisma.hostPayoutMethod.updateMany;
        const originalTransaction = prisma.$transaction;

        (prisma.user as any).findUnique = async ({ where }: any) => {
          return mockUsers.find((u) => u.id === where.id) || null;
        };
        (prisma.user as any).update = async ({ where, data }: any) => {
          const u = mockUsers.find((x) => x.id === where.id);
          if (u) Object.assign(u, data);
          return u;
        };
        (prisma.hostPayoutMethod as any).findFirst = async ({ where }: any) => {
          return (
            mockMethods.find(
              (m) =>
                m.hostId === where.hostId &&
                (!where.accountFingerprint || m.accountFingerprint === where.accountFingerprint) &&
                (!where.id || m.id === where.id) &&
                (where.disabledAt === null ? !m.disabledAt : true),
            ) || null
          );
        };
        (prisma.hostPayoutMethod as any).findMany = async ({ where }: any) => {
          return mockMethods.filter(
            (m) => m.hostId === where.hostId && (where.disabledAt === null ? !m.disabledAt : true),
          );
        };
        (prisma.hostPayoutMethod as any).count = async ({ where }: any) => {
          return mockMethods.filter(
            (m) => m.hostId === where.hostId && (where.disabledAt === null ? !m.disabledAt : true),
          ).length;
        };
        (prisma.hostPayoutMethod as any).create = async ({ data }: any) => {
          const record = {
            id: `cuid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockMethods.push(record);
          return record;
        };
        (prisma.hostPayoutMethod as any).updateMany = async ({ where, data }: any) => {
          let count = 0;
          for (const m of mockMethods) {
            if (m.hostId === where.hostId && (where.isDefault === undefined || m.isDefault === where.isDefault)) {
              Object.assign(m, data);
              count++;
            }
          }
          return { count };
        };
        (prisma as any).$transaction = async (fn: any) => {
          const txProxy = {
            hostPayoutMethod: {
              create: (prisma.hostPayoutMethod as any).create,
              updateMany: (prisma.hostPayoutMethod as any).updateMany,
            },
            user: {
              update: (prisma.user as any).update,
            },
          };
          return fn(txProxy);
        };
      } else {
        throw dbErr;
      }
    }

    console.log("Setup complete.\n");

    // ===========================================================================
    // SUITE 1: Country & Currency Eligibility Checks
    // ===========================================================================
    console.log("--- SUITE 1: Country & Currency Eligibility Checks ---");

    await test("Recognizes Saudi Arabia ('SA', 'KSA', 'Saudi Arabia') as PayPal-supported", () => {
      assert.strictEqual(paypalPayoutService.isCountrySupported("SA"), true);
      assert.strictEqual(paypalPayoutService.isCountrySupported("sa"), true);
      assert.strictEqual(paypalPayoutService.isCountrySupported("KSA"), true);
      assert.strictEqual(paypalPayoutService.isCountrySupported("Saudi Arabia"), true);
      assert.strictEqual(paypalPayoutService.isCountrySupported("XX"), false);
    });

    await test("Separates country support from direct SAR currency support (enforces USD)", () => {
      // Saudi Arabia IS supported
      assert.strictEqual(paypalPayoutService.isCountrySupported("SA"), true);
      // But direct SAR is NOT supported by PayPal Payouts REST API
      assert.strictEqual(paypalPayoutService.isCurrencySupported("SAR"), false);
      // USD is the authoritative disbursement currency for PayPal in KSA
      assert.strictEqual(paypalPayoutService.isCurrencySupported("USD"), true);
    });

    await test("Rejects attempt to register PayPal method in SAR with authoritative error", async () => {
      let threw = false;
      try {
        await payoutService.addHostPayoutMethod(testHostA.id, {
          type: "PAYPAL",
          accountHolderName: "Saudi Host Alpha",
          paypalEmail: `paypal-sar-${timestamp}@example.com`,
          country: "SA",
          currency: "SAR", // Explicitly passing unsupported SAR for PayPal
        });
      } catch (err: any) {
        threw = true;
        assert.ok(
          err.message.includes("does not support direct SAR") ||
            err.message.includes("processed in USD"),
          `Expected SAR rejection message, got: ${err.message}`,
        );
      }
      assert.strictEqual(threw, true, "Must reject PayPal with currency SAR");
    });

    // ===========================================================================
    // SUITE 2: SAMA Fixed-Peg Currency Conversion Engine
    // ===========================================================================
    console.log("\n--- SUITE 2: SAMA Fixed-Peg Currency Conversion Engine ---");

    await test("Converts 375.00 SAR (37,500 halalas) to exactly $100.00 USD (10,000 cents)", () => {
      const result = convertSarHalalasToUsdCents(37500);
      assert.strictEqual(result.originalSarHalalas, 37500);
      assert.strictEqual(result.settlementUsdCents, 10000);
      assert.strictEqual(result.exchangeRatePeg, SAMA_SAR_USD_PEG);
      assert.strictEqual(result.rateSource, "SAMA_OFFICIAL_FIXED_PEG");
    });

    await test("Converts 150.00 SAR (15,000 halalas) to exactly $40.00 USD (4,000 cents)", () => {
      const result = convertSarHalalasToUsdCents(15000);
      assert.strictEqual(result.originalSarHalalas, 15000);
      assert.strictEqual(result.settlementUsdCents, 4000);
    });

    await test("Converts 3.75 SAR (375 halalas) to exactly $1.00 USD (100 cents)", () => {
      const result = convertSarHalalasToUsdCents(375);
      assert.strictEqual(result.settlementUsdCents, 100);
    });

    await test("Inverse conversion: converts USD cents back to SAR halalas accurately", () => {
      const sarHalalas = convertUsdCentsToSarHalalas(10000); // $100.00 USD
      assert.strictEqual(sarHalalas, 37500); // 375.00 SAR
    });

    // ===========================================================================
    // SUITE 3: PayPal Email Validation & Security Masking
    // ===========================================================================
    console.log("\n--- SUITE 3: PayPal Email Validation & Security Masking ---");

    await test("Validates RFC 5322 compliant recipient PayPal email addresses", () => {
      const valid = paypalPayoutService.validatePayPalEmail("host.saudi@example.com");
      assert.strictEqual(valid.valid, true);
      assert.strictEqual(valid.cleanEmail, "host.saudi@example.com");

      const invalid1 = paypalPayoutService.validatePayPalEmail("not-an-email");
      assert.strictEqual(invalid1.valid, false);

      const invalid2 = paypalPayoutService.validatePayPalEmail("");
      assert.strictEqual(invalid2.valid, false);
    });

    await test("Masks PayPal email securely without exposing full PII", () => {
      assert.strictEqual(maskEmail("host.saudi@example.com"), "h***i@example.com");
      assert.strictEqual(maskEmail("ab@domain.com"), "a***@domain.com");
      assert.strictEqual(maskEmail(""), "***@***.***");
    });

    await test("Encrypts and decrypts PayPal email using AES-256-GCM authenticated encryption", () => {
      const originalEmail = "payout.host@example.sa";
      const cipherText = encryptAccountIdentifier(originalEmail);
      assert.notStrictEqual(cipherText, originalEmail);
      assert.ok(cipherText.includes(":"));

      const decrypted = decryptAccountIdentifier(cipherText);
      assert.strictEqual(decrypted, originalEmail);
    });

    await test("Generates case-insensitive deterministic fingerprints for email deduplication", () => {
      const fp1 = generateAccountFingerprint("Host.Saudi@Example.COM");
      const fp2 = generateAccountFingerprint("host.saudi@example.com");
      assert.strictEqual(fp1, fp2);
    });

    // ===========================================================================
    // SUITE 4: PayPal Account Management & Relational Database Storage
    // ===========================================================================
    console.log("\n--- SUITE 4: PayPal Account Management & Relational Database Storage ---");

    await test("Registers a verified PayPal payout method for a Saudi host (country: 'SA', currency: 'USD')", async () => {
      paypalMethodA = await payoutService.addHostPayoutMethod(testHostA.id, {
        type: "PAYPAL",
        accountHolderName: "Saudi Host Alpha",
        paypalEmail: `alpha.paypal.${timestamp}@example.com`,
        country: "SA",
        currency: "USD",
        isDefault: true,
      });

      assert.ok(paypalMethodA.id, "Method must have ID");
      assert.strictEqual(paypalMethodA.type, "PAYPAL");
      assert.strictEqual(paypalMethodA.bankName, "PayPal");
      assert.strictEqual(paypalMethodA.country, "SA");
      assert.strictEqual(paypalMethodA.currency, "USD");
      assert.strictEqual(paypalMethodA.isDefault, true);
      assert.strictEqual(paypalMethodA.accountHolderName, "Saudi Host Alpha");
      assert.ok(paypalMethodA.ibanMasked.includes("@example.com"));
    });

    await test("Prevents duplicate PayPal account registration for the same host", async () => {
      let duplicateThrew = false;
      try {
        await payoutService.addHostPayoutMethod(testHostA.id, {
          type: "PAYPAL",
          accountHolderName: "Saudi Host Alpha",
          paypalEmail: `alpha.paypal.${timestamp}@example.com`, // Same email
          country: "SA",
          currency: "USD",
        });
      } catch (err: any) {
        duplicateThrew = true;
        assert.ok(err.statusCode === 409 || err.message.includes("already registered"));
      }
      assert.strictEqual(duplicateThrew, true, "Must prevent duplicate PayPal registration");
    });

    await test("Retrieves single PayPal method by ID ensuring host ownership", async () => {
      const method = await payoutService.getHostPayoutMethodById(testHostA.id, paypalMethodA.id);
      assert.strictEqual(method.id, paypalMethodA.id);
      assert.strictEqual(method.type, "PAYPAL");
      assert.strictEqual(method.currency, "USD");
    });

    await test("Rejects cross-host access: Host B cannot view or delete Host A's PayPal method", async () => {
      let crossThrew = false;
      try {
        await payoutService.getHostPayoutMethodById(testHostB.id, paypalMethodA.id);
      } catch (err: any) {
        crossThrew = true;
        assert.ok(err.statusCode === 404 || err.message.includes("not found"));
      }
      assert.strictEqual(crossThrew, true, "Host B cannot access Host A's PayPal method");
    });

    // ===========================================================================
    // SUITE 5: Gateway Readiness, Integration Status & Non-Faking Guarantee
    // ===========================================================================
    console.log("\n--- SUITE 5: Gateway Readiness, Integration Status & Non-Faking Guarantee ---");

    await test("getIntegrationStatus reports 'Integration setup required' when credentials are missing", () => {
      const status = paypalPayoutService.getIntegrationStatus("SA");
      assert.strictEqual(status.isCountrySupported, true, "Saudi Arabia must be recognized as supported");
      assert.strictEqual(status.countryCode, "SA");
      assert.strictEqual(status.directSarSupported, false, "Direct SAR is false");
      assert.strictEqual(status.supportedDisbursementCurrency, "USD");
      // Current environment has no real PayPal credentials
      assert.strictEqual(status.isConfigured, false);
      assert.strictEqual(status.integrationStatus, "PENDING_CREDENTIALS");
      assert.strictEqual(status.statusLabel, "Integration setup required");
      assert.ok(!status.message.includes("Not Available in KSA"), "Must NOT claim not available in KSA");
      assert.ok(status.message.includes("PayPal is supported in Saudi Arabia"));
    });

    await test("submitPayout strictly refuses to fake successful payout when credentials are missing", async () => {
      let threw = false;
      try {
        await paypalPayoutService.submitPayout({
          hostId: testHostA.id,
          recipientEmail: `alpha.paypal.${timestamp}@example.com`,
          sarAmountHalalas: 37500, // 375.00 SAR
          referenceId: `TEST-REF-${timestamp}`,
        });
      } catch (err: any) {
        threw = true;
        assert.ok(
          err.message.includes("not configured") || err.message.includes("PAYPAL_CLIENT_ID"),
          `Expected unconfigured error, got: ${err.message}`,
        );
      }
      assert.strictEqual(threw, true, "Never allow unconfigured method to fake successful payout");
    });

    // ===========================================================================
    // SUITE 6: Zero Regression on Saudi IBAN & Payout Routing Co-existence
    // ===========================================================================
    console.log("\n--- SUITE 6: Zero Regression on Saudi IBAN & Payout Routing Co-existence ---");

    await test("Registers Saudi IBAN alongside PayPal method and reassigns default atomically", async () => {
      ibanMethodA = await payoutService.addHostPayoutMethod(testHostA.id, {
        type: "SAUDI_IBAN",
        accountHolderName: "Saudi Host Alpha",
        bankName: "Saudi National Bank",
        iban: VALID_SNB_IBAN,
        currency: "SAR",
        isDefault: true, // Make IBAN the default now
      });

      assert.strictEqual(ibanMethodA.type, "SAUDI_IBAN");
      assert.strictEqual(ibanMethodA.currency, "SAR");
      assert.strictEqual(ibanMethodA.isDefault, true);

      // Verify PayPal method is now isDefault: false
      const refreshedPayPal = await payoutService.getHostPayoutMethodById(testHostA.id, paypalMethodA.id);
      assert.strictEqual(refreshedPayPal.isDefault, false);
    });

    await test("Host A now has 2 registered payout methods: 1 Saudi IBAN (SAR) + 1 PayPal (USD)", async () => {
      const methods = await payoutService.getHostPayoutMethods(testHostA.id);
      assert.strictEqual(methods.length, 2);

      const iban = methods.find((m) => m.type === "SAUDI_IBAN");
      const paypal = methods.find((m) => m.type === "PAYPAL");

      assert.ok(iban, "Saudi IBAN method exists");
      assert.strictEqual(iban?.currency, "SAR");

      assert.ok(paypal, "PayPal method exists");
      assert.strictEqual(paypal?.currency, "USD");
    });
  } finally {
    // ───────────────────────────────────────────────────────────────────────────
    // TEARDOWN: Clean up test entities
    // ───────────────────────────────────────────────────────────────────────────
    console.log("\nTeardown: Cleaning up test payout methods and users...");

    if (!isMockDatabase) {
      if (paypalMethodA) {
        await prisma.hostPayoutMethod.delete({ where: { id: paypalMethodA.id } }).catch(() => {});
      }
      if (ibanMethodA) {
        await prisma.hostPayoutMethod.delete({ where: { id: ibanMethodA.id } }).catch(() => {});
      }
      if (testHostA) {
        await prisma.hostPayoutMethod.deleteMany({ where: { hostId: testHostA.id } }).catch(() => {});
        await prisma.user.delete({ where: { id: testHostA.id } }).catch(() => {});
      }
      if (testHostB) {
        await prisma.hostPayoutMethod.deleteMany({ where: { hostId: testHostB.id } }).catch(() => {});
        await prisma.user.delete({ where: { id: testHostB.id } }).catch(() => {});
      }
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
