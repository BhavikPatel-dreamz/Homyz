import { personalInfoService } from "../services/personal-info.service";
import {
  legalNameSchema,
  preferredNameSchema,
  updateEmailSchema,
  updatePhoneSchema,
  addressSchema,
  postalAddressSchema,
  emergencyContactSchema,
  identityStatusSchema,
} from "../lib/validation/personal-info";
import { maskEmail, maskPhone } from "../components/account-settings/personal-info-view";
import fs from "fs";
import path from "path";

async function runPersonalInformationTests() {
  console.log("\n=======================================================");
  console.log("   ACCOUNT SETTINGS: PERSONAL INFORMATION TEST SUITE   ");
  console.log("=======================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(` ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(` ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // --- 1. Service methods ---
  assert(typeof personalInfoService.getPersonalInfo === "function", "personalInfoService.getPersonalInfo must be a function");
  assert(typeof personalInfoService.updateLegalName === "function", "personalInfoService.updateLegalName must be a function");
  assert(typeof personalInfoService.updatePreferredFirstName === "function", "personalInfoService.updatePreferredFirstName must be a function");
  assert(typeof personalInfoService.updateEmail === "function", "personalInfoService.updateEmail must be a function");
  assert(typeof personalInfoService.updatePhone === "function", "personalInfoService.updatePhone must be a function");
  assert(typeof personalInfoService.updateIdentityStatus === "function", "personalInfoService.updateIdentityStatus must be a function");
  assert(typeof personalInfoService.updateResidentialAddress === "function", "personalInfoService.updateResidentialAddress must be a function");
  assert(typeof personalInfoService.updatePostalAddress === "function", "personalInfoService.updatePostalAddress must be a function");
  assert(typeof personalInfoService.updateEmergencyContact === "function", "personalInfoService.updateEmergencyContact must be a function");

  // --- 2. Masking utilities ---
  const maskedEmail1 = maskEmail("shihab.sheikh@gmail.com");
  assert(maskedEmail1.startsWith("s***") && maskedEmail1.endsWith("@gmail.com"), `maskEmail should mask local part: ${maskedEmail1}`);
  assert(maskEmail(null) === "Not provided", "maskEmail(null) returns 'Not provided'");

  const maskedPhone1 = maskPhone("+91 98765 49861");
  assert(maskedPhone1 === "+91 ***** *9861", `maskPhone should match '+91 ***** *9861': got ${maskedPhone1}`);
  assert(maskPhone(null) === "Not provided", "maskPhone(null) returns 'Not provided'");

  // --- 3. Validation schemas ---
  const validLegal = legalNameSchema.safeParse({ firstName: "Shihab", lastName: "Shaikh" });
  assert(validLegal.success, "legalNameSchema accepts valid first & last name");
  const invalidLegal = legalNameSchema.safeParse({ firstName: "", lastName: "" });
  assert(!invalidLegal.success, "legalNameSchema rejects empty first & last name");

  const validPreferred = preferredNameSchema.safeParse({ preferredFirstName: "Shihab" });
  assert(validPreferred.success, "preferredNameSchema accepts valid preferred name");

  const validEmail = updateEmailSchema.safeParse({ email: "test@homyz.io" });
  assert(validEmail.success && validEmail.data.email === "test@homyz.io", "updateEmailSchema accepts and normalizes email");
  const invalidEmail = updateEmailSchema.safeParse({ email: "invalid-email" });
  assert(!invalidEmail.success, "updateEmailSchema rejects invalid email");

  const validPhone = updatePhoneSchema.safeParse({ phone: "+91 98765 43210" });
  assert(validPhone.success, "updatePhoneSchema accepts valid international phone number");

  const validAddress = addressSchema.safeParse({
    street: "123 Main St",
    city: "San Francisco",
    state: "CA",
    postalCode: "94105",
    country: "United States",
  });
  assert(validAddress.success, "addressSchema accepts valid residential address");

  const validPostal = postalAddressSchema.safeParse({
    sameAsResidential: true,
  });
  assert(validPostal.success && validPostal.data.sameAsResidential === true, "postalAddressSchema accepts sameAsResidential: true");

  const validEmergency = emergencyContactSchema.safeParse({
    name: "Jane Doe",
    relationship: "Spouse",
    countryCode: "+1",
    phoneNumber: "5551234567",
  });
  assert(validEmergency.success, "emergencyContactSchema accepts valid emergency contact");

  const validIdentity = identityStatusSchema.safeParse({ status: "VERIFIED" });
  assert(validIdentity.success, "identityStatusSchema accepts valid enum value VERIFIED");

  // --- 4. UI Component File & Requirements ---
  const uiPath = path.join(process.cwd(), "components/account-settings/personal-info-view.tsx");
  assert(fs.existsSync(uiPath), "components/account-settings/personal-info-view.tsx must exist");
  const uiContent = fs.readFileSync(uiPath, "utf8");

  assert(uiContent.includes("Personal information"), "UI renders 'Personal information' title");
  assert(uiContent.includes("Legal name"), "UI renders Row 1: Legal name");
  assert(uiContent.includes("Preferred first name"), "UI renders Row 2: Preferred first name");
  assert(uiContent.includes("Email address"), "UI renders Row 3: Email address");
  assert(uiContent.includes("Phone number"), "UI renders Row 4: Phone number");
  assert(uiContent.includes("Identity verification"), "UI renders Row 5: Identity verification");
  assert(uiContent.includes("Residential address"), "UI renders Row 6: Residential address");
  assert(uiContent.includes("Postal address"), "UI renders Row 7: Postal address");
  assert(uiContent.includes("Emergency contact"), "UI renders Row 8: Emergency contact");

  // Phone helper text adapted to Homyz branding
  assert(
    uiContent.includes("Contact number (for confirmed guests and Homyz to get in touch)"),
    "Phone helper text must be adapted to Homyz branding",
  );

  // Informational card items
  assert(uiContent.includes("Why isn’t my info shown here?"), "UI includes 'Why isn’t my info shown here?'");
  assert(uiContent.includes("Which details can be edited?"), "UI includes 'Which details can be edited?'");
  assert(uiContent.includes("What info is shared with others?"), "UI includes 'What info is shared with others?'");
  assert(uiContent.includes("Homyz only releases contact information"), "Privacy card refers to Homyz branding");

  // Modal behavior rule
  assert(uiContent.includes("ModalOverlay"), "Identity verification modal must use ModalOverlay from @/components/ui/modal-overlay");

  // --- 5. Routes and Pages ---
  const pagePath = path.join(process.cwd(), "app/(protected)/account-settings/personal-info/page.tsx");
  assert(fs.existsSync(pagePath), "app/(protected)/account-settings/personal-info/page.tsx must exist");

  const redirectPagePath = path.join(process.cwd(), "app/(protected)/account-settings/page.tsx");
  assert(fs.existsSync(redirectPagePath), "app/(protected)/account-settings/page.tsx must exist");
  const redirectContent = fs.readFileSync(redirectPagePath, "utf8");
  assert(redirectContent.includes("/account-settings/personal-info"), "account-settings index page redirects to /account-settings/personal-info");

  // App header link
  const appHeaderPath = path.join(process.cwd(), "components/dashboard/app-header.tsx");
  const appHeaderContent = fs.readFileSync(appHeaderPath, "utf8");
  assert(
    appHeaderContent.includes("/account-settings/personal-info"),
    "AppHeader must link to /account-settings/personal-info for Account settings",
  );

  // Profile tab redirection
  const profileTabPath = path.join(process.cwd(), "app/(protected)/profile/tab/[[...slug]]/page.tsx");
  const profileTabContent = fs.readFileSync(profileTabPath, "utf8");
  assert(
    profileTabContent.includes("/account-settings/personal-info"),
    "Profile tab page redirects personal_info slugs to /account-settings/personal-info",
  );

  // --- 6. Server Actions & API Route ---
  const actionPath = path.join(process.cwd(), "actions/user/personal-info.ts");
  assert(fs.existsSync(actionPath), "actions/user/personal-info.ts must exist");
  const actionContent = fs.readFileSync(actionPath, "utf8");
  assert(actionContent.includes("getSessionUser"), "Server actions authenticate callers with getSessionUser");

  const apiPath = path.join(process.cwd(), "app/api/v1/users/personal-info/route.ts");
  assert(fs.existsSync(apiPath), "app/api/v1/users/personal-info/route.ts must exist");
  const apiContent = fs.readFileSync(apiPath, "utf8");
  assert(apiContent.includes("requireApiAuth"), "API route authenticates with requireApiAuth");

  // --- 7. Identity Document Upload & Self-Verification Prevention ---
  const mappersContent = fs.readFileSync(mappersPath, "utf8");
  assert(!mappersContent.includes("personalInfo:"), "Public user DTO must never leak personalInfo");

  console.log("\n=======================================================");
  console.log(` RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPersonalInformationTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

