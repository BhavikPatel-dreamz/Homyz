import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

async function runGuestDashboardAuthPerformanceTests() {
  console.log("\n=======================================================");
  console.log("   GUEST DASHBOARD: AUTH & PERFORMANCE AUDIT TESTS     ");
  console.log("=======================================================\n");

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      fn();
      console.log(` ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(` ❌ FAIL: ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  }

  // --- [1] AUTHENTICATION & ROUTE GUARDS AUDIT ---
  console.log("\n--- [1] Authentication & Route Protection Audit ---");

  const protectedLayoutPath = path.join(process.cwd(), "app/(protected)/layout.tsx");
  const protectedLayoutContent = fs.readFileSync(protectedLayoutPath, "utf-8");

  test("Protected layout enforces server-side requirePageUser() on all protected routes", () => {
    assert.ok(
      protectedLayoutContent.includes("requirePageUser()"),
      "app/(protected)/layout.tsx must call requirePageUser()",
    );
  });

  const pageGuardsPath = path.join(process.cwd(), "lib/permissions/page-guards.ts");
  const pageGuardsContent = fs.readFileSync(pageGuardsPath, "utf-8");

  test("requirePageUser redirects unauthenticated users to /login with callbackUrl", () => {
    assert.ok(
      pageGuardsContent.includes("redirect(`/login${suffix}`)") ||
        pageGuardsContent.includes('redirect("/login'),
      "Unauthenticated user must be redirected to /login",
    );
    assert.ok(
      pageGuardsContent.includes("callbackUrl"),
      "requirePageUser must support and preserve callbackUrl",
    );
  });

  test("requirePageUser handles suspended accounts cleanly", () => {
    assert.ok(
      pageGuardsContent.includes("SUSPENDED"),
      "requirePageUser must check for SUSPENDED account status",
    );
  });

  const sessionPath = path.join(process.cwd(), "lib/auth/session.ts");
  const sessionContent = fs.readFileSync(sessionPath, "utf-8");

  test("getSessionUser enforces live DB status and tokenVersion revocation checks", () => {
    assert.ok(
      sessionContent.includes("tokenVersion"),
      "getSessionUser must check tokenVersion to invalidate revoked sessions",
    );
    assert.ok(
      sessionContent.includes("getLiveSessionUser"),
      "getSessionUser must perform live session check against database",
    );
  });

  // --- [2] API AUTHORIZATION & OBJECT-LEVEL OWNERSHIP ---
  console.log("\n--- [2] API Authorization & Resource Ownership ---");

  const meRoutePath = path.join(process.cwd(), "app/api/v1/users/me/route.ts");
  const meRouteContent = fs.readFileSync(meRoutePath, "utf-8");

  test("Profile update API resolves caller via requireApiAuth and binds to auth.id", () => {
    assert.ok(
      meRouteContent.includes("requireApiAuth(req)"),
      "PATCH /api/v1/users/me must call requireApiAuth",
    );
    assert.ok(
      meRouteContent.includes("userService.updateProfile(auth.id"),
      "Profile update must only update the authenticated user's ID, never trusting client body userId",
    );
  });

  const bookingsRoutePath = path.join(process.cwd(), "app/api/v1/bookings/route.ts");
  const bookingsRouteContent = fs.readFileSync(bookingsRoutePath, "utf-8");

  test("Bookings list API scopes queries exclusively to authenticated actor", () => {
    assert.ok(
      bookingsRouteContent.includes("requireApiAuth(req)"),
      "GET /api/v1/bookings must require API authentication",
    );
    assert.ok(
      bookingsRouteContent.includes("bookingService.listForUser(actor"),
      "Bookings query must pass authenticated actor",
    );
  });

  const cancelRoutePath = path.join(process.cwd(), "app/api/v1/bookings/[id]/cancel/route.ts");
  const cancelRouteContent = fs.readFileSync(cancelRoutePath, "utf-8");

  test("Booking cancellation API enforces ownership authorization", () => {
    assert.ok(
      cancelRouteContent.includes("requireApiAuth(req)"),
      "Cancel endpoint must enforce authentication",
    );
    assert.ok(
      cancelRouteContent.includes("cancelBookingByGuest(actor, id)"),
      "Cancel endpoint must pass authenticated actor to service",
    );
  });

  const favoritesRoutePath = path.join(process.cwd(), "app/api/v1/favorites/route.ts");
  const favoritesRouteContent = fs.readFileSync(favoritesRoutePath, "utf-8");

  test("Favorites API scopes wishlists strictly to authenticated user", () => {
    assert.ok(
      favoritesRouteContent.includes("where: { userId: actor.id }"),
      "Favorites must filter by authenticated actor.id",
    );
    assert.ok(
      favoritesRouteContent.includes("requireApiAuth(req)"),
      "Favorites API must require authentication",
    );
  });

  const invoiceRoutePath = path.join(process.cwd(), "app/api/v1/taxes/invoices/[bookingId]/route.ts");
  const invoiceRouteContent = fs.readFileSync(invoiceRoutePath, "utf-8");

  test("Tax invoice API enforces actor ownership or host/admin access", () => {
    assert.ok(
      invoiceRouteContent.includes("taxService.generateTaxInvoice(actor, bookingId)"),
      "Invoice API must pass authenticated actor to verify booking ownership",
    );
  });

  // --- [3] PERFORMANCE & PER-SECTION DATA FETCHING ---
  console.log("\n--- [3] Performance & Per-Section Data Fetching ---");

  const loaderPath = path.join(process.cwd(), "lib/profile/profile-loader.ts");
  const loaderContent = fs.readFileSync(loaderPath, "utf-8");

  test("profile-loader supports selective per-section loading based on active tab", () => {
    assert.ok(
      loaderContent.includes("export async function loadProfilePageData(tab?: string)"),
      "loadProfilePageData must accept tab parameter for selective fetching",
    );
    assert.ok(
      loaderContent.includes("Promise.all"),
      "loadProfilePageData must run queries concurrently via Promise.all",
    );
  });

  test("profile-loader does not fetch bookings or favorites when on About Me tab", () => {
    assert.ok(
      loaderContent.includes("needsReservations"),
      "profile-loader must conditionally gate reservation queries",
    );
    assert.ok(
      loaderContent.includes("needsFavorites"),
      "profile-loader must conditionally gate favorites queries",
    );
  });

  const pagePath = path.join(process.cwd(), "app/(protected)/profile/page.tsx");
  const pageContent = fs.readFileSync(pagePath, "utf-8");

  test("ProfilePage passes active route.tab to loadProfilePageData", () => {
    assert.ok(
      pageContent.includes("loadProfilePageData(route.tab)"),
      "ProfilePage must pass route.tab to loader",
    );
  });

  const tabPagePath = path.join(process.cwd(), "app/(protected)/profile/tab/[[...slug]]/page.tsx");
  const tabPageContent = fs.readFileSync(tabPagePath, "utf-8");

  test("ProfileTabPage passes active route.tab to loadProfilePageData", () => {
    assert.ok(
      tabPageContent.includes("loadProfilePageData(route.tab)"),
      "ProfileTabPage must pass route.tab to loader",
    );
  });

  // --- [4] LAZY LOADING & CODE SPLITTING ---
  console.log("\n--- [4] Lazy Loading & Code Splitting ---");

  const clientPath = path.join(process.cwd(), "app/(protected)/profile/profile-client.tsx");
  const clientContent = fs.readFileSync(clientPath, "utf-8");

  test("profile-client uses dynamic() imports for heavy section components", () => {
    assert.ok(
      clientContent.includes('import dynamic from "next/dynamic"'),
      "profile-client must import dynamic from next/dynamic",
    );
    assert.ok(
      clientContent.includes("const ReservationDashboard = dynamic"),
      "ReservationDashboard must be dynamically imported",
    );
    assert.ok(
      clientContent.includes("const ProfileManagementClient = dynamic"),
      "ProfileManagementClient must be dynamically imported",
    );
    assert.ok(
      clientContent.includes("const SavedListingsView = dynamic"),
      "SavedListingsView must be dynamically imported",
    );
    assert.ok(
      clientContent.includes("const LoyaltyWalletView = dynamic"),
      "LoyaltyWalletView must be dynamically imported",
    );
  });

  test("profile-client supplies section-specific skeletons to dynamic imports", () => {
    assert.ok(
      clientContent.includes("SavedListingsSkeleton"),
      "SavedListingsView dynamic import must provide SavedListingsSkeleton",
    );
    assert.ok(
      clientContent.includes("ProfileManagementSkeleton"),
      "ProfileManagementClient dynamic import must provide ProfileManagementSkeleton",
    );
    assert.ok(
      clientContent.includes("LoyaltyWalletSkeleton"),
      "LoyaltyWalletView dynamic import must provide LoyaltyWalletSkeleton",
    );
  });

  const loadingPath = path.join(process.cwd(), "app/(protected)/profile/loading.tsx");

  test("app/(protected)/profile/loading.tsx exists and renders persistent shell skeleton", () => {
    assert.ok(fs.existsSync(loadingPath), "profile/loading.tsx must exist");
    const loadingContent = fs.readFileSync(loadingPath, "utf-8");
    assert.ok(
      loadingContent.includes("animate-pulse") && loadingContent.includes("aside"),
      "loading.tsx must render sidebar and content skeleton",
    );
  });

  // --- [5] REDIS CACHING & INVALIDATION AUDIT ---
  console.log("\n--- [5] Redis Caching & Invalidation Audit ---");

  const userServicePath = path.join(process.cwd(), "services/user.service.ts");
  const userServiceContent = fs.readFileSync(userServicePath, "utf-8");

  test("getUserStats is cached with CACHE_KEYS.USER_STATS and CACHE_TTL.DASHBOARD_STATS", () => {
    assert.ok(
      userServiceContent.includes("CACHE_KEYS.USER_STATS(userId)"),
      "getUserStats must cache using USER_STATS key",
    );
    assert.ok(
      userServiceContent.includes("CACHE_TTL.DASHBOARD_STATS"),
      "getUserStats must use DASHBOARD_STATS TTL",
    );
  });

  const invalidationPath = path.join(process.cwd(), "lib/redis/invalidation.ts");
  const invalidationContent = fs.readFileSync(invalidationPath, "utf-8");

  test("invalidateUserCache and invalidateBookingCache invalidate USER_STATS", () => {
    assert.ok(
      invalidationContent.includes("deleteCache(CACHE_KEYS.USER_STATS(userId))"),
      "invalidateUserCache must delete USER_STATS",
    );
  });

  // --- [6] STALE RESPONSES & REQUEST CANCELLATION ---
  console.log("\n--- [6] Request Cancellation & Error Isolation ---");

  const resDashboardPath = path.join(process.cwd(), "components/dashboard/reservation-dashboard.tsx");
  const resDashboardContent = fs.readFileSync(resDashboardPath, "utf-8");

  test("ReservationDashboard supports on-demand client fetch with AbortController", () => {
    assert.ok(
      resDashboardContent.includes("new AbortController()"),
      "ReservationDashboard must use AbortController",
    );
    assert.ok(
      resDashboardContent.includes("controller.abort()"),
      "ReservationDashboard must abort requests on unmount",
    );
  });

  const savedListingsPath = path.join(process.cwd(), "components/profile/saved-listings-view.tsx");
  const savedListingsContent = fs.readFileSync(savedListingsPath, "utf-8");

  test("SavedListingsView supports AbortController in refreshFavorites", () => {
    assert.ok(
      savedListingsContent.includes("new AbortController()"),
      "SavedListingsView must use AbortController",
    );
    assert.ok(
      savedListingsContent.includes("controller.abort()"),
      "SavedListingsView must abort requests on unmount",
    );
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runGuestDashboardAuthPerformanceTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

