import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { updateHostPublicProfileSchema } from "@/lib/validation/host-profile";

console.log("\n==================================================================");
console.log("   ADMIN ABOUT HOST VERIFICATION SUITE                           ");
console.log("==================================================================\n");

// --- [1] Component File Existence & Architecture ---
console.log("--- [1] Component File Existence & Architecture ---");
const adminViewPath = path.resolve(
  __dirname,
  "../app/(protected)/admin/listings/[id]/components/AdminAboutHostView.tsx"
);
assert(fs.existsSync(adminViewPath), "AdminAboutHostView.tsx file must exist");
const adminViewCode = fs.readFileSync(adminViewPath, "utf-8");

// --- [2] Host Profile Card & System Information (Read-Only) ---
console.log("\n--- [2] Host Profile Card & Read-Only System Information ---");
assert(
  adminViewCode.includes("hostProfile.name"),
  "Must render host display name"
);
assert(
  adminViewCode.includes("Host Rating"),
  "Must display Host Rating label"
);
assert(
  adminViewCode.includes("Hosting Tenure"),
  "Must display Hosting Tenure label"
);
assert(
  adminViewCode.includes("hostingTenure"),
  "Must compute hosting tenure from authoritative registration date"
);
assert(
  adminViewCode.includes("hostRating"),
  "Must display host rating system information"
);
assert(
  !adminViewCode.includes('name="rating"') && !adminViewCode.includes('id="rating"'),
  "Rating must NOT have an editable input or form control"
);
assert(
  !adminViewCode.includes('name="tenure"') && !adminViewCode.includes('id="tenure"'),
  "Tenure must NOT have an editable input or form control"
);

// --- [3] Host Details Fields ---
console.log("\n--- [3] Host Details Fields ---");
assert(
  adminViewCode.includes("What makes your home unique"),
  "Must render 'What makes your home unique' field"
);
assert(
  adminViewCode.includes("What guests should know"),
  "Must render 'What guests should know' field"
);
assert(
  adminViewCode.includes("Languages spoken"),
  "Must render 'Languages spoken' field"
);
assert(
  adminViewCode.includes("LANGUAGE_OPTIONS"),
  "Languages spoken must use authoritative LANGUAGE_OPTIONS"
);
assert(
  adminViewCode.includes("My hobbies"),
  "Must render 'My hobbies' field"
);
assert(
  adminViewCode.includes("Education / background"),
  "Must render 'Education / background' field"
);
assert(
  adminViewCode.includes("My perfect guest"),
  "Must render 'My perfect guest' field"
);
assert(
  adminViewCode.includes("Biography headline"),
  "Must render 'Biography headline' field"
);

// --- [4] About Me (Long-form Textarea) ---
console.log("\n--- [4] About Me (Long-form Textarea) ---");
assert(
  adminViewCode.includes("About Me"),
  "Must render 'About Me' section header"
);
assert(
  adminViewCode.includes("bio.length"),
  "Must display character counter for long-form bio"
);
assert(
  adminViewCode.includes("maxLength={2000}"),
  "About Me textarea must enforce 2,000 char maximum"
);

// --- [5] Retired travel stamps ---
console.log("\n--- [5] Retired Travel Stamps ---");
assert(
  !adminViewCode.includes("WhereIveBeenSelector") && !adminViewCode.includes("TravelStampGraphic"),
  "Must not render retired travel-stamp controls"
);

// --- [6] My Interests (Multi-select, Chips with [ × ], + Add Interest) ---
console.log("\n--- [6] My Interests ---");
assert(
  adminViewCode.includes("My Interests"),
  "Must render 'My Interests' section"
);
assert(
  adminViewCode.includes("removeInterest"),
  "Must allow removing selected interest chips with [ × ]"
);
assert(
  adminViewCode.includes("addInterest"),
  "Must allow adding new interests"
);
assert(
  adminViewCode.includes("REFERENCE_INTERESTS"),
  "Must provide suggested interests from REFERENCE_INTERESTS"
);

// --- [7] Sticky Save & Cancel Controls, Dirty State & Permissions ---
console.log("\n--- [7] Save & Cancel Controls, Dirty Tracking & Permissions ---");
assert(
  adminViewCode.includes("handleCancel"),
  "Must provide Cancel handler to discard changes"
);
assert(
  adminViewCode.includes("handleSave"),
  "Must provide Save handler"
);
assert(
  adminViewCode.includes("isDirty"),
  "Must track dirty state against baseline persisted values"
);
assert(
  adminViewCode.includes("canEdit"),
  "Must support canEdit permission flag for view-only mode"
);

// --- [8] Admin Action & API Integration ---
console.log("\n--- [8] Admin Action & API Integration ---");
const listingActionsPath = path.resolve(
  __dirname,
  "../actions/admin/listingActions.ts"
);
const actionsCode = fs.readFileSync(listingActionsPath, "utf-8");
assert(
  actionsCode.includes("export async function adminUpdateListingHostProfileAction"),
  "actions/admin/listingActions.ts must export adminUpdateListingHostProfileAction"
);
assert(
  actionsCode.includes("ADMIN_UPDATE_HOST_PROFILE"),
  "adminUpdateListingHostProfileAction must record audit trail"
);
assert(
  actionsCode.includes("PERMISSIONS.LISTINGS_EDIT"),
  "adminUpdateListingHostProfileAction must require LISTINGS_EDIT permission"
);

// --- [9] HostListingEditorClient & HostAndLocationViews Integration ---
console.log("\n--- [9] Editor Mounting Integration ---");
const hostViewsPath = path.resolve(
  __dirname,
  "../app/(protected)/host/listings/[id]/components/HostAndLocationViews.tsx"
);
const hostViewsCode = fs.readFileSync(hostViewsPath, "utf-8");
assert(
  hostViewsCode.includes("<AdminAboutHostView"),
  "HostAndLocationViews must mount AdminAboutHostView when presentation is admin"
);
assert(
  hostViewsCode.includes('props.presentation === "admin"'),
  "HostAndLocationViews must check presentation prop for admin mode"
);

// --- [10] Schema Validation Parity ---
console.log("\n--- [10] Schema Validation Parity ---");
const testPayload = {
  bio: "Welcome to my home in Riyadh! I am an architect passionate about sustainable housing.",
  prompts: {
    homeUnique: "Direct garden courtyard with shade trees.",
    guestsShouldKnow: "Quiet hours from 10 PM. Fast WiFi available.",
    hobbies: ["Architecture", "Photography", "Desert Hiking"],
    education: "Architecture B.Arch",
    perfectGuest: "Conscientious travelers.",
    biography: "Riyadh-based architect hosting international guests.",
  },
  languages: ["en", "ar", "fr"],
  interests: ["Cooking", "Architecture", "History"],
};

const parsed = updateHostPublicProfileSchema.parse(testPayload);
assert.equal(parsed.bio, testPayload.bio);
assert.equal(parsed.prompts?.homeUnique, testPayload.prompts.homeUnique);
assert.deepEqual(parsed.prompts?.hobbies, ["Architecture", "Photography", "Desert Hiking"]);
assert.deepEqual(parsed.languages, ["en", "ar", "fr"]);
assert.deepEqual(parsed.interests, ["Cooking", "Architecture", "History"]);

console.log("\n==================================================================");
console.log("   🎉 ALL ADMIN ABOUT HOST VERIFICATION TESTS PASSED (100%)!      ");
console.log("==================================================================\n");
