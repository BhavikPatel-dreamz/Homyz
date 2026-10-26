import "dotenv/config";
import assert from "node:assert";
import { prisma } from "../lib/db/prisma";
import {
  encryptAccountIdentifier,
  decryptAccountIdentifier,
  generateAccountFingerprint,
} from "../lib/security/payout-encryption";
import {
  validateSaudiIban,
  maskIban,
  payoutService,
  type HostPayoutMethod,
} from "../services/payout.service";
import { Role } from "@/generated/prisma/enums";

// Known valid Saudi IBAN (Al Rajhi Bank, 24 chars)
const VALID_RAJHI_IBAN = "SA0380000000608010167519";
// Known valid Saudi IBAN (SNB / AlAhli, 24 chars)
const VALID_SNB_IBAN = "SA0910000000000000000001";

async function runTests() {
  console.log("=== RUNNING HOMYZ PHASE 3 COMPREHENSIVE TEST SUITE ===\n");

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
      failed++;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 1: IBAN Validation & SAMA Bank Directory
  // ───────────────────────────────────────────────────────────────────────────
  console.log("Suite 1: Saudi IBAN & SAMA Bank Directory");

  await test("Validates valid Saudi IBAN with MOD-97 check digits", () => {
    const res = validateSaudiIban(VALID_RAJHI_IBAN);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.cleanIban, VALID_RAJHI_IBAN);
    assert.strictEqual(res.bankCode, "80");
    assert.ok(res.bankName?.includes("Al Rajhi"));
    assert.strictEqual(res.formatted, "SA03 8000 0000 6080 1016 7519");
  });

  await test("Identifies Saudi National Bank (SNB) correctly", () => {
    const res = validateSaudiIban(VALID_SNB_IBAN);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.bankCode, "10");
    assert.ok(res.bankName?.includes("Saudi National Bank"));
  });

  await test("Rejects invalid checksum digits in IBAN", () => {
    const invalidChecksum = "SA0480000000608010167519";
    const res = validateSaudiIban(invalidChecksum);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error?.includes("checksum"));
  });

  await test("Rejects IBAN not starting with SA", () => {
    const res = validateSaudiIban("AE0380000000608010167519");
    assert.strictEqual(res.valid, false);
    assert.ok(res.error?.includes("start with 'SA'"));
  });

  await test("Rejects IBAN with invalid length", () => {
    const resShort = validateSaudiIban("SA038000");
    assert.strictEqual(resShort.valid, false);
    assert.ok(resShort.error?.includes("24 characters"));
  });

  await test("Masks IBAN according to security standards", () => {
    const masked = maskIban(VALID_RAJHI_IBAN);
    assert.strictEqual(masked, "SA03 **** **** **** **** 7519");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 2: AES-256-GCM Encryption & Fingerprinting
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\nSuite 2: AES-256-GCM Encryption & Account Fingerprinting");

  await test("Encrypts and decrypts IBAN correctly using AES-256-GCM", () => {
    const cipherText = encryptAccountIdentifier(VALID_RAJHI_IBAN);
    assert.ok(cipherText.includes(":"), "Serialized cipher must have iv:tag:data format");
    const parts = cipherText.split(":");
    assert.strictEqual(parts.length, 3);

    const decrypted = decryptAccountIdentifier(cipherText);
    assert.strictEqual(decrypted, VALID_RAJHI_IBAN);
  });

  await test("Safely rejects tampered ciphertext without crashing", () => {
    const cipherText = encryptAccountIdentifier(VALID_RAJHI_IBAN);
    const parts = cipherText.split(":");
    parts[2] = parts[2].slice(0, -2) + "00";
    const tampered = parts.join(":");

    const decrypted = decryptAccountIdentifier(tampered);
    assert.strictEqual(decrypted, null);
  });

  await test("Generates deterministic account fingerprints for deduplication", () => {
    const fp1 = generateAccountFingerprint(VALID_RAJHI_IBAN);
    const fp2 = generateAccountFingerprint("SA03 8000 0000 6080 1016 7519");
    const fp3 = generateAccountFingerprint("sa03-8000-0000-6080-1016-7519");

    assert.strictEqual(fp1, fp2);
    assert.strictEqual(fp2, fp3);
    assert.strictEqual(fp1.length, 64);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 3: Relational Database CRUD & Dual-Read Fallback
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\nSuite 3: Relational Database CRUD & Dual-Read Fallback");

  const testHostEmail = `test-host-phase3-${Date.now()}@example.com`;
  let testHostId = "";
  let createdMethod1Id = "";
  let createdMethod2Id = "";

  await test("Creates isolated test host user", async () => {
    const user = await prisma.user.create({
      data: {
        email: testHostEmail,
        name: "Phase3 Test Host",
        role: Role.HOST,
        personalInfo: {
          identityStatus: "VERIFIED",
        },
      },
    });
    testHostId = user.id;
    assert.ok(testHostId);
  });

  await test("Returns empty payout methods list for new host", async () => {
    const methods = await payoutService.getHostPayoutMethods(testHostId);
    assert.deepStrictEqual(methods, []);
  });

  await test("Adds primary payout method relationally (marks default automatically)", async () => {
    const method1 = await payoutService.addHostPayoutMethod(testHostId, {
      accountHolderName: "Phase3 Test Host",
      bankName: "Al Rajhi Bank",
      iban: VALID_RAJHI_IBAN,
      routingCode: "Primary Riyadh Branch",
    });

    createdMethod1Id = method1.id;
    assert.ok(createdMethod1Id);
    assert.strictEqual(method1.bankCode, "80");
    assert.strictEqual(method1.ibanMasked, "SA03 **** **** **** **** 7519");
    assert.strictEqual(method1.isDefault, true);
    assert.strictEqual(method1.status, "VERIFIED");

    // Check relational record in DB
    const dbRecord = await prisma.hostPayoutMethod.findUnique({
      where: { id: createdMethod1Id },
    });
    assert.ok(dbRecord);
    assert.strictEqual(dbRecord.hostId, testHostId);
    assert.strictEqual(dbRecord.isDefault, true);
    assert.ok(dbRecord.encryptedAccountReference);

    // Verify decrypted IBAN in DB matches original
    const decrypted = decryptAccountIdentifier(dbRecord.encryptedAccountReference!);
    assert.strictEqual(decrypted, VALID_RAJHI_IBAN);
  });

  await test("Prevents duplicate IBAN registration for the same host", async () => {
    let duplicateRejected = false;
    try {
      await payoutService.addHostPayoutMethod(testHostId, {
        accountHolderName: "Duplicate Holder",
        bankName: "Al Rajhi Bank",
        iban: "SA03 8000 0000 6080 1016 7519",
      });
    } catch (err: any) {
      duplicateRejected = true;
      assert.ok(err.message.includes("already registered"));
    }
    assert.strictEqual(duplicateRejected, true);
  });

  await test("Adds secondary payout method as non-default", async () => {
    const method2 = await payoutService.addHostPayoutMethod(testHostId, {
      accountHolderName: "Phase3 Test Host",
      bankName: "Saudi National Bank",
      iban: VALID_SNB_IBAN,
      isDefault: false,
    });

    createdMethod2Id = method2.id;
    assert.strictEqual(method2.isDefault, false);
    assert.strictEqual(method2.bankCode, "10");

    const allMethods = await payoutService.getHostPayoutMethods(testHostId);
    assert.strictEqual(allMethods.length, 2);
    // Method 1 should be first because it's default
    assert.strictEqual(allMethods[0].id, createdMethod1Id);
    assert.strictEqual(allMethods[0].isDefault, true);
    assert.strictEqual(allMethods[1].id, createdMethod2Id);
    assert.strictEqual(allMethods[1].isDefault, false);
  });

  await test("Retrieves single method by ID verifying ownership", async () => {
    const single = await payoutService.getHostPayoutMethodById(testHostId, createdMethod1Id);
    assert.strictEqual(single.id, createdMethod1Id);
    assert.strictEqual(single.accountHolderName, "Phase3 Test Host");
  });

  await test("Updates permitted editable fields without mutating immutable IBAN", async () => {
    const updated = await payoutService.updateHostPayoutMethod(testHostId, createdMethod1Id, {
      accountHolderName: "Phase3 Test Host (Updated Legal)",
      routingCode: "Updated Branch 42",
    });

    assert.strictEqual(updated.accountHolderName, "Phase3 Test Host (Updated Legal)");
    assert.strictEqual(updated.routingCode, "Updated Branch 42");
    assert.strictEqual(updated.ibanMasked, "SA03 **** **** **** **** 7519");
  });

  await test("Atomically changes default payout method", async () => {
    const updatedList = await payoutService.setDefaultPayoutMethod(testHostId, createdMethod2Id);
    const m2 = updatedList.find((m) => m.id === createdMethod2Id);
    const m1 = updatedList.find((m) => m.id === createdMethod1Id);

    assert.strictEqual(m2?.isDefault, true);
    assert.strictEqual(m1?.isDefault, false);
  });

  await test("Soft-deletes payout method and reassigns default", async () => {
    const remaining = await payoutService.deleteHostPayoutMethod(testHostId, createdMethod2Id);
    assert.strictEqual(remaining.length, 1);
    assert.strictEqual(remaining[0].id, createdMethod1Id);
    assert.strictEqual(remaining[0].isDefault, true);

    const dbM2 = await prisma.hostPayoutMethod.findUnique({
      where: { id: createdMethod2Id },
    });
    assert.ok(dbM2?.disabledAt);
    assert.strictEqual(dbM2?.status, "DISABLED");
    assert.strictEqual(dbM2?.isDefault, false);
  });

  await test("Admin verifies payout method and records audit log", async () => {
    const adminUser = await prisma.user.create({
      data: {
        email: `admin-phase3-${Date.now()}@example.com`,
        name: "Phase3 Test Admin",
        role: Role.ADMIN,
      },
    });

    const adminActor = {
      id: adminUser.id,
      email: adminUser.email!,
      role: Role.ADMIN,
    };

    try {
      const verified = await payoutService.verifyHostPayoutMethod(
        adminActor,
        testHostId,
        createdMethod1Id,
        "VERIFIED",
      );

      assert.strictEqual(verified.status, "VERIFIED");
      assert.ok(verified.verifiedAt);

      const rejected = await payoutService.verifyHostPayoutMethod(
        adminActor,
        testHostId,
        createdMethod1Id,
        "REJECTED",
        "Beneficiary name does not match Nafath registry",
      );

      assert.strictEqual(rejected.status, "REJECTED");
      assert.strictEqual(rejected.rejectionReason, "Beneficiary name does not match Nafath registry");
    } finally {
      await prisma.user.delete({ where: { id: adminUser.id } });
    }
  });

  await test("Dual-read fallback: reads legacy User.personalInfo.payoutMethods if relational is empty", async () => {
    const legacyHostEmail = `legacy-host-${Date.now()}@example.com`;
    const legacyUser = await prisma.user.create({
      data: {
        email: legacyHostEmail,
        name: "Legacy Host",
        role: Role.HOST,
        personalInfo: {
          payoutMethods: [
            {
              id: "pm_legacy_123",
              accountHolderName: "Legacy Host",
              bankName: "Riyad Bank",
              bankCode: "20",
              ibanMasked: "SA03 **** **** **** **** 9999",
              ibanLast4: "9999",
              currency: "SAR",
              isDefault: true,
              status: "VERIFIED",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        },
      },
    });

    const methods = await payoutService.getHostPayoutMethods(legacyUser.id);
    assert.strictEqual(methods.length, 1);
    assert.strictEqual(methods[0].id, "pm_legacy_123");
    assert.strictEqual(methods[0].bankName, "Riyad Bank");
    assert.strictEqual(methods[0].isDefault, true);

    await prisma.user.delete({ where: { id: legacyUser.id } });
  });

  await test("exportBatchSettlementCSV formats headers and executes cleanly with relational methods", async () => {
    const adminUser = await prisma.user.create({
      data: {
        email: `admin-csv-${Date.now()}@example.com`,
        name: "Admin CSV",
        role: Role.ADMIN,
      },
    });
    try {
      const csv = await payoutService.exportBatchSettlementCSV(
        {
          id: adminUser.id,
          email: adminUser.email!,
          role: Role.ADMIN,
        },
        [],
      );
      assert.ok(csv.startsWith("Booking Reference,Beneficiary Name,Beneficiary IBAN"));
    } finally {
      await prisma.user.delete({ where: { id: adminUser.id } });
    }
  });

  await test("Cleans up test records safely", async () => {
    if (testHostId) {
      await prisma.hostPayoutMethod.deleteMany({ where: { hostId: testHostId } });
      await prisma.user.delete({ where: { id: testHostId } });
    }
  });

  console.log("\n=======================================================");
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((err) => {
    console.error("Fatal test runner failure:", err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
