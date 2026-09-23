import fs from "fs";
import path from "path";
import { MAX_BIO_LENGTH } from "../app/(protected)/profile-management/profile-management-client";

async function runProfileManagementSyncTests() {
  console.log("\n=======================================================");
  console.log("   PROFILE MANAGEMENT REFINEMENT & SYNC TESTS          ");
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

  // 1. Character Limit Constant Verification
  assert(MAX_BIO_LENGTH === 500, "MAX_BIO_LENGTH is exported and equals 500");

  // 2. Read file contents of profile-management-client.tsx
  const pmPath = path.join(process.cwd(), "app/(protected)/profile-management/profile-management-client.tsx");
  const pmContent = fs.readFileSync(pmPath, "utf-8");

  // 3. Verify Removal of Hardcoded Dummy Values & Prefill
  assert(
    !pmContent.includes('whereILive: pub.whereILive || "Bucharest, Romania"'),
    "Removed hardcoded dummy fallback 'Bucharest, Romania' from whereILive state init",
  );
  assert(
    pmContent.includes('whereILive: pub.whereILive || ""'),
    "whereILive correctly defaults to pub.whereILive || ''",
  );
  assert(
    !pmContent.includes("I'm a digital nomad"),
    "Removed hardcoded digital nomad dummy boilerplate from bio",
  );
  assert(
    pmContent.includes('bio: pub.bio || ""'),
    "bio correctly defaults to pub.bio || ''",
  );
  assert(
    !pmContent.includes('return "English and Russian"'),
    "Removed hardcoded 'English and Russian' fallback in languagesForInput",
  );
  assert(
    pmContent.includes('return value || ""'),
    "languagesForInput safely returns empty string if undefined",
  );

  // 4. Character Limit & Validation in Profile Management
  assert(
    pmContent.includes("maxLength={MAX_BIO_LENGTH}"),
    "About me textarea enforces maxLength={MAX_BIO_LENGTH}",
  );
  assert(
    pmContent.includes("(formDataState.bio || \"\").length} / {MAX_BIO_LENGTH}"),
    "Live character counter is displayed for About me",
  );
  assert(
    pmContent.includes(".slice(0, MAX_BIO_LENGTH)"),
    "bio is explicitly truncated to MAX_BIO_LENGTH on input and submit",
  );
  assert(
    pmContent.includes("const trimmedBio = (formDataState.bio || \"\").trim().slice(0, MAX_BIO_LENGTH)"),
    "bio whitespace is trimmed prior to saving",
  );

  // 5. Save Button States & Responsiveness
  assert(
    !pmContent.includes("hidden lg:inline-flex") && pmContent.includes("inline-flex items-center justify-center"),
    "Save profile button is visible across all viewports (mobile and desktop)",
  );
  assert(
    pmContent.includes('saveStatus === "saving" ?') &&
    pmContent.includes("Saving...") &&
    pmContent.includes("Saved!"),
    "Save button provides visual feedback for saving and saved states",
  );
  assert(
    pmContent.includes("disabled={pending || saveStatus === \"saving\"}"),
    "Save button is disabled while saving to prevent duplicate submissions",
  );

  // 6. Cross-Component Synchronization
  assert(
    pmContent.includes('window.dispatchEvent(new CustomEvent("homyz:profile-updated"'),
    "profile-management-client dispatches 'homyz:profile-updated' event on successful save",
  );
  assert(
    pmContent.includes("onProfileUpdated?.(updated)"),
    "profile-management-client notifies parent via onProfileUpdated callback",
  );

  // 7. Verify Parent Profile Client Synchronization
  const pcPath = path.join(process.cwd(), "app/(protected)/profile/profile-client.tsx");
  const pcContent = fs.readFileSync(pcPath, "utf-8");

  assert(
    pcContent.includes('const [currentUser, setCurrentUser] = useState<ProfileData>(initial)'),
    "ProfileClient maintains reactive currentUser state",
  );
  assert(
    pcContent.includes('window.addEventListener("homyz:profile-updated"'),
    "ProfileClient listens for 'homyz:profile-updated' custom event",
  );
  assert(
    pcContent.includes("initial={currentUser}"),
    "ProfileClient passes reactive currentUser to ProfileManagementClient",
  );
  assert(
    pcContent.includes("onProfileUpdated={(updated) => setCurrentUser(updated)}"),
    "ProfileClient updates currentUser when ProfileManagementClient saves",
  );
  assert(
    !pcContent.includes("initialStats.trips || 12"),
    "ProfileClient does not use fake fallback 12 for trips count",
  );
  assert(
    !pcContent.includes("initialStats.reviews || 10"),
    "ProfileClient does not use fake fallback 10 for reviews count",
  );
  assert(
    !pcContent.includes('"English and Russian"'),
    "ProfileClient does not display fake 'English and Russian' fallback language",
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runProfileManagementSyncTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});

