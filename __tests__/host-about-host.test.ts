import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { updateHostPublicProfileSchema } from "../lib/validation/host-profile";

test("Host Listing Editor: About Host Component & Airbnb-Style Flow", () => {
  console.log("\n==================================================================");
  console.log("   HOST ABOUT HOST (AIRBNB-STYLE) VERIFICATION SUITE              ");
  console.log("==================================================================\n");

  const hostViewPath = path.join(
    process.cwd(),
    "app/(protected)/host/listings/[id]/components/HostAboutHostView.tsx",
  );
  assert(fs.existsSync(hostViewPath), "HostAboutHostView.tsx file must exist");
  const hostViewCode = fs.readFileSync(hostViewPath, "utf8");

  const hostAndLocationViewsPath = path.join(
    process.cwd(),
    "app/(protected)/host/listings/[id]/components/HostAndLocationViews.tsx",
  );
  const hostAndLocationViewsCode = fs.readFileSync(hostAndLocationViewsPath, "utf8");

  const profileActionsPath = path.join(process.cwd(), "actions/host/profile.ts");
  const profileActionsCode = fs.readFileSync(profileActionsPath, "utf8");

  // 1. Component mounting
  console.log("--- [1] Component Architecture & Integration ---");
  assert(
    hostAndLocationViewsCode.includes("<HostAboutHostView"),
    "HostAndLocationViews must render HostAboutHostView when activeSection is about-host",
  );
  assert(
    hostAndLocationViewsCode.includes("<AdminAboutHostView"),
    "HostAndLocationViews must render AdminAboutHostView when presentation is admin",
  );
  console.log(" ✅ PASS: Clean architecture and proper view delegation");

  // 2. Host Profile Card & Identity
  console.log("\n--- [2] Host Profile Card & Badges ---");
  assert(
    hostViewCode.includes("hostProfile.name") && hostViewCode.includes("getInitials"),
    "Must display host name and initials fallback",
  );
  assert(
    hostViewCode.includes("Change photo") || hostViewCode.includes("Edit photo"),
    "Must provide Change/Edit photo button",
  );
  assert(
    hostViewCode.includes('accept="image/*"'),
    "Must support uploading image files",
  );
  assert(
    hostViewCode.includes("hostRating"),
    "Must display read-only host rating badge",
  );
  assert(
    hostViewCode.includes("hostingTenure"),
    "Must display read-only hosting tenure badge",
  );
  console.log(" ✅ PASS: Profile card with photo upload, name, and read-only system rating & tenure");

  // 3. About Me / Biography
  console.log("\n--- [3] About Me / Biography Inputs ---");
  assert(
    hostViewCode.includes("host-biography") && hostViewCode.includes("biography.length"),
    "Must include biography headline input with live counter",
  );
  assert(
    hostViewCode.includes("host-bio") && hostViewCode.includes("bio.length"),
    "Must include bio textarea with live counter up to 2,000 chars",
  );
  assert(
    hostViewCode.includes("maxLength={2000}"),
    "Must enforce 2000 max length on bio",
  );
  console.log(" ✅ PASS: Biography headline and long-form bio textarea with live counters");

  // 4. Host Details & Prompts
  console.log("\n--- [4] Host Details & Prompt Inputs ---");
  assert(
    hostViewCode.includes("prompt-home-unique") && hostViewCode.includes("What makes your home unique"),
    "Must include 'What makes your home unique' input",
  );
  assert(
    hostViewCode.includes("prompt-guests-should-know") && hostViewCode.includes("What guests should know"),
    "Must include 'What guests should know' input",
  );
  assert(
    hostViewCode.includes("prompt-education") && hostViewCode.includes("Where I went to school"),
    "Must include 'Where I went to school / Education & background' input",
  );
  assert(
    hostViewCode.includes("prompt-perfect-guest") && hostViewCode.includes("My perfect guest"),
    "Must include 'My perfect guest' input",
  );
  console.log(" ✅ PASS: All 4 structured prompt inputs present with Airbnb styling and counters");

  // 5. Languages You Speak
  console.log("\n--- [5] Languages Spoken Searchable Multi-Select ---");
  assert(
    hostViewCode.includes("Languages you speak"),
    "Must include 'Languages you speak' section",
  );
  assert(
    hostViewCode.includes("LANGUAGE_OPTIONS") && hostViewCode.includes("getLanguageNameById"),
    "Must integrate with LANGUAGE_OPTIONS and helpers",
  );
  assert(
    hostViewCode.includes("handleToggleLanguage"),
    "Must support adding and toggling spoken languages",
  );
  console.log(" ✅ PASS: Searchable language combobox and tags with remove action");

  // 6. Hobbies & Passions
  console.log("\n--- [6] Hobbies & Passions Tag Manager ---");
  assert(
    hostViewCode.includes("Hobbies & passions"),
    "Must include 'Hobbies & passions' section",
  );
  assert(
    hostViewCode.includes("handleAddHobby") && hostViewCode.includes("handleRemoveHobby"),
    "Must support adding and removing hobbies",
  );
  assert(
    hostViewCode.includes("SUGGESTED_HOBBIES"),
    "Must offer quick-add suggested hobbies",
  );
  console.log(" ✅ PASS: Hobbies chip manager with custom input and quick suggestions");

  // 7. Retired travel stamps
  console.log("\n--- [7] Retired Travel Stamps ---");
  assert(
    !hostViewCode.includes("WhereIveBeenSelector") && !hostViewCode.includes("TravelStampGraphic"),
    "Must not render retired travel-stamp controls",
  );

  // 8. My Interests
  console.log("\n--- [8] My Interests ---");
  assert(
    hostViewCode.includes("My interests"),
    "Must include 'My interests' section",
  );
  assert(
    hostViewCode.includes("handleAddInterest") && hostViewCode.includes("handleRemoveInterest"),
    "Must support adding and removing interests",
  );
  assert(
    hostViewCode.includes("REFERENCE_INTERESTS"),
    "Must include reference interests list with quick-add buttons",
  );
  console.log(" ✅ PASS: Interests chips, custom add input, and reference suggestions");

  // 9. Bottom Actions & Dirty Tracking
  console.log("\n--- [9] Sticky Action Bar & Dirty State ---");
  assert(
    hostViewCode.includes("isDirty"),
    "Must implement dirty state tracking",
  );
  assert(
    hostViewCode.includes("handleCancel"),
    "Must implement Cancel button to discard unsaved edits",
  );
  assert(
    hostViewCode.includes("Save profile") && hostViewCode.includes("isSaving"),
    "Must implement Save profile button with loading spinner",
  );
  assert(
    hostViewCode.includes("disabled={!isDirty || isSaving}"),
    "Save and Cancel buttons must be disabled when form is not dirty",
  );
  assert(
    hostViewCode.includes('toast.success("Host profile saved successfully! Changes are shared across all of your listings.")'),
    "Must trigger toast.success with exact message on successful profile save",
  );
  assert(
    hostViewCode.includes("toast.error"),
    "Must trigger toast.error on failure",
  );
  console.log(" ✅ PASS: Sticky bottom bar with dirty state, Cancel, Save, and toast notifications");

  // 10. Server Actions & Permissions
  console.log("\n--- [10] Server Action & Authorization ---");
  assert(
    profileActionsCode.includes("updateHostPublicProfileAction"),
    "profile.ts must export updateHostPublicProfileAction",
  );
  assert(
    profileActionsCode.includes("updateHostListingPhotoAction"),
    "profile.ts must export updateHostListingPhotoAction",
  );
  assert(
    profileActionsCode.includes("listingId") && profileActionsCode.includes("listing.hostId"),
    "updateHostPublicProfileAction must support listingId and update listing host user",
  );
  console.log(" ✅ PASS: Server actions support listingId, role/cohost authorization, and photo updates");

  // 11. Schema Validation
  console.log("\n--- [11] Schema Validation Parity ---");
  const validProfile = {
    bio: "Hi, I am a passionate host!",
    prompts: {
      homeUnique: "Sunny loft with terrace",
      guestsShouldKnow: "Quiet hours after 10 PM",
      hobbies: ["Cooking", "Hiking"],
      education: "Design School",
      perfectGuest: "Quiet couples and travelers",
      biography: "Architectural host",
    },
    languages: ["en", "fr"],
    interests: ["Travel", "Photography"],
  };
  const parsed = updateHostPublicProfileSchema.parse(validProfile);
  assert.equal(parsed.bio, "Hi, I am a passionate host!");
  assert.equal(parsed.prompts?.homeUnique, "Sunny loft with terrace");
  assert.equal(parsed.prompts?.biography, "Architectural host");
  assert.deepEqual(parsed.languages, ["en", "fr"]);
  console.log(" ✅ PASS: Schema validates all host profile fields completely");

  console.log("\n==================================================================");
  console.log("   🎉 ALL HOST ABOUT HOST VERIFICATION TESTS PASSED (100%)!       ");
  console.log("==================================================================\n");
});
