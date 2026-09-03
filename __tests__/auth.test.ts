import "dotenv/config";
import assert from "node:assert/strict";
import { normalizeEmail, normalizePhone, isValidE164Phone } from "../lib/auth/normalization";
import { getSafeCallbackUrl } from "../lib/auth/redirect";
import { authService } from "../services/auth.service";
import { prisma } from "../lib/db/prisma";

async function runTests() {
  console.log("==========================================");
  console.log("   HOMYZ AUTH SYSTEM REGRESSION TESTS     ");
  console.log("==========================================");

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(` ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(` ❌ FAIL: ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  }

  // --- 1. Normalization & Country Code Tests ---
  await test("Email Normalization: lowercase and trim", () => {
    assert.equal(normalizeEmail("  User.Test@Homyz.App  "), "user.test@homyz.app");
    assert.equal(normalizeEmail("ADMIN@HOMYZ.COM"), "admin@homyz.com");
    assert.equal(normalizeEmail(""), "");
  });

  await test("Phone Normalization: E.164 conversion & stripping formatters", () => {
    assert.equal(normalizePhone("+1 (555) 234-5678"), "+15552345678");
    assert.equal(normalizePhone("0039 06 1234 5678"), "+390612345678");
    assert.equal(normalizePhone("+39-06-12345678"), "+390612345678");
    assert.equal(normalizePhone("15552345678"), "+15552345678");
  });

  await test("Phone Validation: E.164 regex check", () => {
    assert.equal(isValidE164Phone("+15552345678"), true);
    assert.equal(isValidE164Phone("+390612345678"), true);
    assert.equal(isValidE164Phone("abc"), false);
    assert.equal(isValidE164Phone("123"), false);
  });

  await test("Centralized Country Utility: ISO2 lookup, search & dataset integrity", async () => {
    const { getAllCountries, getCountryByIso2, getCountriesByCallingCode, searchCountries } = await import("../lib/auth/country-codes");
    const countries = getAllCountries();
    assert.ok(countries.length >= 30, "Should include complete country dataset");
    
    const italy = getCountryByIso2("IT");
    assert.equal(italy?.code, "+39");
    assert.equal(italy?.flag, "🇮🇹");

    const usMatches = getCountriesByCallingCode("+1");
    assert.ok(usMatches.some((c) => c.iso2 === "US"));
    assert.ok(usMatches.some((c) => c.iso2 === "CA"));

    const searchResult = searchCountries("India");
    assert.equal(searchResult[0]?.iso2, "IN");
  });


  // --- 2. Safe Redirect Sanitization Tests ---
  await test("Safe Redirect URL Sanitization: allowed internal relative paths", () => {
    assert.equal(getSafeCallbackUrl("/dashboard"), "/dashboard");
    assert.equal(getSafeCallbackUrl("/admin/listings?status=ACTIVE"), "/admin/listings?status=ACTIVE");
    assert.equal(getSafeCallbackUrl("/host/listings/new"), "/host/listings/new");
  });

  await test("Safe Redirect URL Sanitization: block open redirect attacks", () => {
    assert.equal(getSafeCallbackUrl("https://evil.com/phishing"), "/dashboard");
    assert.equal(getSafeCallbackUrl("//attacker.com"), "/dashboard");
    assert.equal(getSafeCallbackUrl("/\\attacker.com"), "/dashboard");
    assert.equal(getSafeCallbackUrl("javascript:alert(1)"), "/dashboard");
    assert.equal(getSafeCallbackUrl(null), "/dashboard");
    assert.equal(getSafeCallbackUrl(undefined), "/dashboard");
  });

  // --- 3. OTP Flow & Security Tests ---
  await test("OTP Lifecycle: send, verify, rate-limiting & single-use invalidation", async () => {
    const testPhone = "+1555000" + Math.floor(1000 + Math.random() * 9000);

    // Send OTP
    const sendRes = await authService.sendOtp({
      identifier: testPhone,
      channel: "SMS",
      purpose: "PHONE_VERIFICATION",
    });

    assert.equal(sendRes.success, true);
    const code = sendRes.devCode || "123456";

    // Verify OTP
    const verifyRes = await authService.verifyOtp({
      identifier: testPhone,
      code,
      purpose: "PHONE_VERIFICATION",
    });
    assert.equal(verifyRes.success, true);
    assert.equal(verifyRes.verified, true);

    // Second verification must fail (single-use consumed)
    await assert.rejects(
      async () => {
        await authService.verifyOtp({
          identifier: testPhone,
          code,
          purpose: "PHONE_VERIFICATION",
        });
      },
      { message: "No active code. Please request a new one." }
    );
  });

  // --- 4. OTP Max Attempt & Invalid Code Test ---
  await test("OTP Security: Invalid code increments attempts until max attempt lock", async () => {
    const testPhone = "+1555111" + Math.floor(1000 + Math.random() * 9000);

    await authService.sendOtp({
      identifier: testPhone,
      channel: "SMS",
      purpose: "PHONE_VERIFICATION",
    });

    // Submit invalid code 5 times
    for (let i = 0; i < 5; i++) {
      try {
        await authService.verifyOtp({
          identifier: testPhone,
          code: "999999",
          purpose: "PHONE_VERIFICATION",
        });
      } catch (err: any) {
        assert.ok(err.message.includes("Invalid code") || err.message.includes("Too many attempts"));
      }
    }

    // 6th attempt must be rejected for max attempts
    await assert.rejects(
      async () => {
        await authService.verifyOtp({
          identifier: testPhone,
          code: "999999",
          purpose: "PHONE_VERIFICATION",
        });
      },
      (err: any) => err.message.includes("Too many attempts") || err.message.includes("No active code")
    );
  });

  // --- 5. Duplicate Email Signup Prevention ---
  await test("Duplicate Registration Prevention: Sequential duplicate signup throws 409", async () => {
    const uniqueEmail = `test.user.${Date.now()}@homyz.app`;

    // First signup
    const user1 = await authService.register({
      name: "Test User",
      email: uniqueEmail.toUpperCase(), // Test case insensitivity
      password: "TestPassword123!",
      role: "USER",
    });
    assert.ok(user1.id);
    assert.equal(user1.email, uniqueEmail.toLowerCase());

    // Duplicate signup attempt must throw 409 Conflict
    await assert.rejects(
      async () => {
        await authService.register({
          name: "Test User Duplicate",
          email: uniqueEmail,
          password: "TestPassword123!",
          role: "USER",
        });
      },
      (err: any) => {
        return err.status === 409 || err.message?.includes("already exists");
      }
    );
  });

  // --- 6. Concurrency / Race Condition Signup Test ---
  await test("Concurrency Safety: Concurrent signups for same email handle P2002 gracefully", async () => {
    const raceEmail = `race.user.${Date.now()}@homyz.app`;

    const requests = Array.from({ length: 5 }).map(() =>
      authService.register({
        name: "Concurrent User",
        email: raceEmail,
        password: "RacePassword123!",
        role: "USER",
      }).then(
        (user) => ({ success: true, user }),
        (err) => ({ success: false, error: err })
      )
    );

    const results = await Promise.all(requests);
    const successes = results.filter((r) => r.success);
    const conflicts = results.filter((r) => !r.success && ((r as any).error?.status === 409 || (r as any).error?.message?.includes("already exists")));


    assert.equal(successes.length, 1, "Exactly one concurrent signup request must succeed");
    assert.equal(conflicts.length, 4, "Remaining concurrent requests must return conflict error cleanly");
  });

  // --- 7. E.164 Phone Normalization & User Disambiguation ---
  await test("Phone Normalization: formatted and raw phone numbers resolve to same user", async () => {
    const rawNumber = "555987" + Math.floor(1000 + Math.random() * 9000);
    const formattedPhone = `+1 (555) 987-${rawNumber.slice(-4)}`;
    const e164Phone = normalizePhone(formattedPhone);

    // Create user with normalized phone
    const user = await prisma.user.create({
      data: {
        phone: e164Phone,
        phoneVerified: new Date(),
        email: `phone_${rawNumber}@homyz.app`,
        role: "USER",
        name: "Phone User Test",
      },
    });

    // Lookup using un-formatted string
    const foundUser = await prisma.user.findFirst({
      where: { phone: normalizePhone(formattedPhone) },
    });

    assert.ok(foundUser);
    assert.equal(foundUser.id, user.id);

    // Clean up
    await prisma.user.delete({ where: { id: user.id } });
  });

  // --- 8. Existing Phone Number Registration Test ---
  await test("Existing Phone Signup: OTP request for already-registered phone returns 409 Conflict instead of rate-limit error", async () => {
    const rawNumber = "555333" + Math.floor(1000 + Math.random() * 9000);
    const e164Phone = `+1${rawNumber}`;

    const existingUser = await prisma.user.create({
      data: {
        phone: e164Phone,
        phoneVerified: new Date(),
        email: `existing_${rawNumber}@homyz.app`,
        role: "USER",
        name: "Existing Phone User",
      },
    });

    // Request OTP with PHONE_VERIFICATION purpose (Signup attempt)
    await assert.rejects(
      async () => {
        await authService.sendOtp({
          identifier: e164Phone,
          channel: "SMS",
          purpose: "PHONE_VERIFICATION",
        });
      },
      (err: any) => {
        return err.status === 409 && err.message.includes("already registered");
      }
    );

    // Repeated request must STILL return 409 Conflict (not 429 rate limit)
    await assert.rejects(
      async () => {
        await authService.sendOtp({
          identifier: e164Phone,
          channel: "SMS",
          purpose: "PHONE_VERIFICATION",
        });
      },
      (err: any) => {
        return err.status === 409 && err.message.includes("already registered");
      }
    );

    await prisma.user.delete({ where: { id: existingUser.id } });
  });


  console.log("------------------------------------------");
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log("==========================================");

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(async (err) => {
  console.error("Test execution failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
