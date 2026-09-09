import { GUEST_NAV_ITEMS, extractTabFromQuery } from "../components/dashboard/guest-sidebar";
import {
  GUEST_NAV_ITEMS as DIRECT_NAV_ITEMS,
  extractTabFromQuery as directExtractTab,
  extractSubTabFromQuery,
  PROFILE_MGMT_SUB_TABS,
} from "../lib/profile/tab-utils";
import fs from "fs";
import path from "path";

async function runProfileTabPathTests() {
  console.log("\n=======================================================");
  console.log("   PROFILE TAB PATHS (/profile?tab/...) TEST SUITE    ");
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

  // 1. Check GUEST_NAV_ITEMS URLs
  const profileMgmtItem = GUEST_NAV_ITEMS.find((item) => item.id === "profile_management");
  assert(
    profileMgmtItem?.href === "/profile?tab/profile_management",
    "profile_management href must be '/profile?tab/profile_management'",
  );

  assert(
    !profileMgmtItem?.href.includes("?tab="),
    "profile_management href must NOT contain '?tab='",
  );

  const upcomingItem = GUEST_NAV_ITEMS.find((item) => item.id === "upcoming_trips");
  assert(
    upcomingItem?.href === "/profile?tab/upcoming",
    "upcoming_trips href must be '/profile?tab/upcoming'",
  );

  const pastItem = GUEST_NAV_ITEMS.find((item) => item.id === "past_bookings");
  assert(
    pastItem?.href === "/profile?tab/past",
    "past_bookings href must be '/profile?tab/past'",
  );

  const loyaltyItem = GUEST_NAV_ITEMS.find((item) => item.id === "loyalty");
  assert(
    loyaltyItem?.href === "/profile?tab/loyalty",
    "loyalty href must be '/profile?tab/loyalty'",
  );

  const inviteItem = GUEST_NAV_ITEMS.find((item) => item.id === "invite");
  assert(
    inviteItem?.href === "/profile?tab/invite",
    "invite href must be '/profile?tab/invite'",
  );

  const savedItem = GUEST_NAV_ITEMS.find((item) => item.id === "saved");
  assert(
    savedItem?.href === "/profile?tab/saved",
    "saved href must be '/profile?tab/saved'",
  );

  const supportItem = GUEST_NAV_ITEMS.find((item) => item.id === "support");
  assert(
    supportItem?.href === "/profile?tab/support",
    "support href must be '/profile?tab/support'",
  );

  const notifItem = GUEST_NAV_ITEMS.find((item) => item.id === "notifications");
  assert(
    notifItem?.href === "/profile?tab/notifications",
    "notifications href must be '/profile?tab/notifications'",
  );

  // 2. Check extractTabFromQuery parser
  assert(
    extractTabFromQuery(new URLSearchParams("?tab/profile_management")) === "profile_management",
    "extractTabFromQuery with '?tab/profile_management' resolves to 'profile_management'",
  );

  assert(
    extractTabFromQuery(null, "?tab/profile_management") === "profile_management",
    "extractTabFromQuery with raw string '?tab/profile_management' resolves to 'profile_management'",
  );

  assert(
    extractTabFromQuery(new URLSearchParams("?tab/upcoming")) === "upcoming_trips",
    "extractTabFromQuery with '?tab/upcoming' resolves to normalized 'upcoming_trips'",
  );

  assert(
    extractTabFromQuery(new URLSearchParams("?tab/past")) === "past_bookings",
    "extractTabFromQuery with '?tab/past' resolves to normalized 'past_bookings'",
  );

  assert(
    extractTabFromQuery({ "tab/profile_management": "" }) === "profile_management",
    "extractTabFromQuery with Next.js server searchParams object resolves to 'profile_management'",
  );

  // Backward-compatibility check: still supports old ?tab= format
  assert(
    extractTabFromQuery(new URLSearchParams("?tab=profile_management")) === "profile_management",
    "extractTabFromQuery backward compatibility with '?tab=profile_management'",
  );

  // Default fallback check
  assert(
    extractTabFromQuery(null) === "about_me",
    "extractTabFromQuery with empty params resolves to 'about_me'",
  );

  // 3. Verify direct exports from lib/profile/tab-utils
  assert(
    DIRECT_NAV_ITEMS.length === GUEST_NAV_ITEMS.length,
    "lib/profile/tab-utils DIRECT_NAV_ITEMS length matches GUEST_NAV_ITEMS",
  );
  assert(
    directExtractTab(new URLSearchParams("?tab/profile_management")) === "profile_management",
    "directExtractTab resolves '?tab/profile_management'",
  );

  // 4. Verify Server Component app/(protected)/profile/page.tsx imports from server-safe tab-utils
  const profilePageContent = fs.readFileSync(path.join(process.cwd(), "app/(protected)/profile/page.tsx"), "utf-8");
  assert(
    profilePageContent.includes('from "@/lib/profile/tab-utils"') || profilePageContent.includes("from '@/lib/profile/tab-utils'"),
    "app/(protected)/profile/page.tsx imports extractTabFromQuery from server-safe '@/lib/profile/tab-utils'",
  );
  assert(
    !profilePageContent.includes('extractTabFromQuery } from "@/components/dashboard/guest-sidebar"'),
    "app/(protected)/profile/page.tsx does NOT import extractTabFromQuery from client component 'guest-sidebar'",
  );

  // 5. Verify Profile Management Sub-Tabs (/profile?tab/profile_management/...)
  const subTripPhotos = PROFILE_MGMT_SUB_TABS.find((item) => item.id === "photos");
  assert(
    subTripPhotos?.href === "/profile?tab/profile_management/trip_photos",
    "photos href must be '/profile?tab/profile_management/trip_photos'",
  );
  assert(
    subTripPhotos?.slug === "trip_photos",
    "photos slug must be 'trip_photos'",
  );

  const subProfileInfo = PROFILE_MGMT_SUB_TABS.find((item) => item.id === "info");
  assert(
    subProfileInfo?.href === "/profile?tab/profile_management/profile_information",
    "info href must be '/profile?tab/profile_management/profile_information'",
  );

  const subStamps = PROFILE_MGMT_SUB_TABS.find((item) => item.id === "stamps");
  assert(
    subStamps?.href === "/profile?tab/profile_management/where_ive_been",
    "stamps href must be '/profile?tab/profile_management/where_ive_been'",
  );

  const subPrivacy = PROFILE_MGMT_SUB_TABS.find((item) => item.id === "privacy");
  assert(
    subPrivacy?.href === "/profile?tab/profile_management/privacy_visibility",
    "privacy href must be '/profile?tab/profile_management/privacy_visibility'",
  );

  // 6. Verify subtab query extraction
  assert(
    extractSubTabFromQuery(new URLSearchParams("?tab/profile_management/trip_photos")) === "photos",
    "extractSubTabFromQuery with '?tab/profile_management/trip_photos' resolves to 'photos'",
  );
  assert(
    extractTabFromQuery(new URLSearchParams("?tab/profile_management/trip_photos")) === "profile_management",
    "extractTabFromQuery with '?tab/profile_management/trip_photos' still resolves to primary tab 'profile_management'",
  );

  assert(
    extractSubTabFromQuery(new URLSearchParams("?tab/profile_management/where_ive_been")) === "stamps",
    "extractSubTabFromQuery with '?tab/profile_management/where_ive_been' resolves to 'stamps'",
  );
  assert(
    extractSubTabFromQuery(new URLSearchParams("?tab/profile_management/privacy_visibility")) === "privacy",
    "extractSubTabFromQuery with '?tab/profile_management/privacy_visibility' resolves to 'privacy'",
  );
  assert(
    extractSubTabFromQuery(new URLSearchParams("?tab/profile_management/profile_information")) === "info",
    "extractSubTabFromQuery with '?tab/profile_management/profile_information' resolves to 'info'",
  );
  assert(
    extractSubTabFromQuery(new URLSearchParams("?tab/profile_management")) === "info",
    "extractSubTabFromQuery with '?tab/profile_management' defaults to 'info'",
  );

  // Next.js server searchParams object with subtabs
  assert(
    extractSubTabFromQuery({ "tab/profile_management/trip_photos": "" }) === "photos",
    "extractSubTabFromQuery with Next.js server searchParams object resolves to 'photos'",
  );
  assert(
    extractTabFromQuery({ "tab/profile_management/trip_photos": "" }) === "profile_management",
    "extractTabFromQuery with Next.js server searchParams object resolves to 'profile_management'",
  );

  // Raw search strings
  assert(
    extractSubTabFromQuery(null, "?tab/profile_management/trip_photos") === "photos",
    "extractSubTabFromQuery with raw '?tab/profile_management/trip_photos' resolves to 'photos'",
  );
  assert(
    extractSubTabFromQuery(null, "?tab/profile_management/photos") === "photos",
    "extractSubTabFromQuery with alias 'photos' resolves to 'photos'",
  );
  assert(
    extractSubTabFromQuery(null, "?tab/profile_management/stamps") === "stamps",
    "extractSubTabFromQuery with alias 'stamps' resolves to 'stamps'",
  );
  assert(
    extractSubTabFromQuery(null, "?tab/profile_management/privacy") === "privacy",
    "extractSubTabFromQuery with alias 'privacy' resolves to 'privacy'",
  );

  // 7. Verify files on disk do NOT contain old '/profile?tab=' format
  const filesToCheck = [
    "components/dashboard/guest-sidebar.tsx",
    "app/(protected)/profile/profile-client.tsx",
    "app/(protected)/profile-management/page.tsx",
    "app/(protected)/profile-management/profile-management-client.tsx",
    "app/(protected)/bookings/page.tsx",
    "lib/profile/tab-utils.ts",
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(process.cwd(), relPath);
    const content = fs.readFileSync(fullPath, "utf-8");
    assert(
      !content.includes("/profile?tab="),
      `${relPath} must NOT contain '/profile?tab='`,
    );
  }

  // 8. Verify profile-management-client.tsx has links to all 4 subtabs
  const clientContent = fs.readFileSync(path.join(process.cwd(), "app/(protected)/profile-management/profile-management-client.tsx"), "utf-8");
  assert(
    clientContent.includes("/profile?tab/profile_management/trip_photos"),
    "profile-management-client.tsx links to '/profile?tab/profile_management/trip_photos'",
  );
  assert(
    clientContent.includes("/profile?tab/profile_management/profile_information"),
    "profile-management-client.tsx links to '/profile?tab/profile_management/profile_information'",
  );
  assert(
    clientContent.includes("/profile?tab/profile_management/where_ive_been"),
    "profile-management-client.tsx links to '/profile?tab/profile_management/where_ive_been'",
  );
  assert(
    clientContent.includes("/profile?tab/profile_management/privacy_visibility"),
    "profile-management-client.tsx links to '/profile?tab/profile_management/privacy_visibility'",
  );

  console.log("\n-------------------------------------------------------");
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runProfileTabPathTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

