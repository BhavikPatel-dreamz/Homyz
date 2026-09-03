import "dotenv/config";
import { normalizePhone, isValidE164Phone } from "../lib/auth/normalization";
import { prisma } from "../lib/db/prisma";
import { authService } from "../services/auth.service";

async function runAuthFlowAuditTests() {
  console.log("\n=======================================================");
  console.log("  AUTHENTICATION & USER FLOW COMPREHENSIVE AUDIT TESTS  ");
  console.log("=======================================================\n");

  const testPhone = "+393339988771";
  const unregisteredPhone = "+393330000000";
  const testEmail = "auth_audit_test_user@homyz.app";

  try {
    // Cleanup previous test artifacts if any
    await prisma.user.deleteMany({
      where: { OR: [{ email: testEmail }, { phone: testPhone }] },
    });
    await prisma.otpCode.deleteMany({
      where: { identifier: { in: [testPhone, unregisteredPhone, testEmail] } },
    });

    // 1. Test Phone Normalization
    const norm1 = normalizePhone("+39 333-998-8771");
    const norm2 = normalizePhone("00393339988771");
    if (norm1 !== testPhone || norm2 !== testPhone) {
      throw new Error(`Phone normalization failed. Expected ${testPhone}, got norm1=${norm1}, norm2=${norm2}`);
    }
    console.log(" ✅ PASS: Phone Normalization (E.164 consistency)");

    // 2. Test Unregistered Mobile Number on LOGIN (Must reject with notFound)
    try {
      await authService.sendOtp({
        identifier: unregisteredPhone,
        channel: "SMS",
        purpose: "LOGIN",
      });
      throw new Error("FAIL: Unregistered number was allowed to request OTP on LOGIN!");
    } catch (err: any) {
      if (!err?.message?.includes("not registered")) {
        throw new Error(`Expected 'not registered' error for login, got: ${err?.message}`);
      }
    }
    console.log(" ✅ PASS: Unregistered mobile number on LOGIN rejected with prompt to register");

    // 3. Test Register New Account with Phone Number
    const newUser = await authService.register({
      name: "Audit Test User",
      email: testEmail,
      password: "TestPassword123!",
      role: "USER",
      phone: testPhone,
    });
    if (!newUser || !newUser.id) {
      throw new Error("Registration failed to create public user");
    }
    console.log(" ✅ PASS: Account creation with verified phone number");

    // 4. Test Registered Mobile Number on SIGNUP (Must reject with conflict)
    try {
      await authService.sendOtp({
        identifier: testPhone,
        channel: "SMS",
        purpose: "PHONE_VERIFICATION",
      });
      throw new Error("FAIL: Registered number was allowed to request OTP on SIGNUP!");
    } catch (err: any) {
      if (!err?.message?.includes("already registered")) {
        throw new Error(`Expected 'already registered' error for signup, got: ${err?.message}`);
      }
    }
    console.log(" ✅ PASS: Duplicate registration attempt rejected with prompt to log in");

    // 5. Test Registered Mobile Number on LOGIN (Must succeed)
    const loginOtp = await authService.sendOtp({
      identifier: testPhone,
      channel: "SMS",
      purpose: "LOGIN",
    });
    if (!loginOtp.success || !loginOtp.devCode) {
      throw new Error("Failed to send OTP for registered mobile number");
    }
    console.log(" ✅ PASS: Registered mobile number OTP request succeeds on LOGIN");

    // 6. Test Invalid OTP Code
    try {
      await authService.verifyOtp({
        identifier: testPhone,
        code: "000000",
        purpose: "LOGIN",
      });
      throw new Error("FAIL: Invalid OTP code was accepted!");
    } catch (err: any) {
      if (!err?.message?.includes("incorrect")) {
        throw new Error(`Expected 'incorrect' OTP error, got: ${err?.message}`);
      }
    }
    console.log(" ✅ PASS: Invalid OTP code rejected with clear actionable error");

    // 7. Test Valid OTP Verification
    const verifyRes = await authService.verifyOtp({
      identifier: testPhone,
      code: loginOtp.devCode,
      purpose: "LOGIN",
    });
    if (!verifyRes.success) {
      throw new Error("Valid OTP failed to verify");
    }
    console.log(" ✅ PASS: Valid OTP verification succeeds");

    // 8. Test Suspended Account Blocking
    await prisma.user.update({
      where: { email: testEmail },
      data: { status: "SUSPENDED" },
    });
    try {
      await authService.sendOtp({
        identifier: testPhone,
        channel: "SMS",
        purpose: "LOGIN",
      });
      throw new Error("FAIL: Suspended account allowed OTP request!");
    } catch (err: any) {
      if (!err?.message?.includes("unavailable") && !err?.message?.includes("support")) {
        throw new Error(`Expected suspended account error, got: ${err?.message}`);
      }
    }
    console.log(" ✅ PASS: Suspended account blocked with contact support error");

    console.log("\n=======================================================");
    console.log("  ALL AUTHENTICATION AUDIT TESTS PASSED SUCCESSFULLY!  ");
    console.log("=======================================================\n");
  } finally {
    // Cleanup
    await prisma.user.deleteMany({
      where: { OR: [{ email: testEmail }, { phone: testPhone }] },
    });
    await prisma.otpCode.deleteMany({
      where: { identifier: { in: [testPhone, unregisteredPhone, testEmail] } },
    });
  }
}

runAuthFlowAuditTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Test Suite Failed:", err);
    process.exit(1);
  });
