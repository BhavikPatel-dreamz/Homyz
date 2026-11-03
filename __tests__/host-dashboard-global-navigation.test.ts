import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("\n==================================================================");
console.log("   HOST DASHBOARD GLOBAL NAVIGATION COMPREHENSIVE VERIFICATION   ");
console.log("==================================================================\n");

const appHeaderPath = path.resolve("./components/dashboard/app-header.tsx");
const hostHeaderPath = path.resolve("./components/host/host-header.tsx");
const hostSubNavPath = path.resolve("./components/host/host-sub-nav.tsx");
const hostLayoutPath = path.resolve("./app/(protected)/host/layout.tsx");

const hostTodayPagePath = path.resolve("./app/(protected)/host/today/page.tsx");
const hostCalendarPagePath = path.resolve("./app/(protected)/host/calendar/page.tsx");
const hostListingsPagePath = path.resolve("./app/(protected)/host/listings/page.tsx");
const hostMessagesPagePath = path.resolve("./app/(protected)/host/messages/page.tsx");
const hostBookingsPagePath = path.resolve("./app/(protected)/host/bookings/page.tsx");
const hostBookingDetailPagePath = path.resolve("./app/(protected)/host/bookings/[id]/page.tsx");
const hostListingEditorPath = path.resolve("./app/(protected)/host/listings/[id]/host-listing-editor-client.tsx");
const hostMessagesWorkspacePath = path.resolve("./components/host/messages/host-messages-workspace.tsx");

const appHeaderCode = fs.readFileSync(appHeaderPath, "utf-8");
const hostHeaderCode = fs.readFileSync(hostHeaderPath, "utf-8");
const hostSubNavCode = fs.readFileSync(hostSubNavPath, "utf-8");
const hostLayoutCode = fs.readFileSync(hostLayoutPath, "utf-8");
const hostTodayPageCode = fs.readFileSync(hostTodayPagePath, "utf-8");
const hostCalendarPageCode = fs.readFileSync(hostCalendarPagePath, "utf-8");
const hostListingsPageCode = fs.readFileSync(hostListingsPagePath, "utf-8");
const hostMessagesPageCode = fs.readFileSync(hostMessagesPagePath, "utf-8");
const hostBookingsPageCode = fs.readFileSync(hostBookingsPagePath, "utf-8");
const hostBookingDetailPageCode = fs.readFileSync(hostBookingDetailPagePath, "utf-8");
const hostListingEditorCode = fs.readFileSync(hostListingEditorPath, "utf-8");
const hostMessagesWorkspaceCode = fs.readFileSync(hostMessagesWorkspacePath, "utf-8");

let passed = 0;
let total = 0;

function runTest(name: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(` ✅ PASS: Test ${total}: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(` ❌ FAIL: Test ${total}: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------------------
// 1. GLOBAL HOST HEADER CONSISTENCY & MOUNTING
// -----------------------------------------------------------------------------
runTest("All primary host pages mount the shared HostHeader", () => {
  assert.ok(hostTodayPageCode.includes("<HostHeader />"), "Today page must mount HostHeader");
  assert.ok(hostCalendarPageCode.includes("<HostHeader />"), "Calendar page must mount HostHeader");
  assert.ok(hostMessagesPageCode.includes("<HostHeader />"), "Messages page must mount HostHeader");
  assert.ok(hostBookingsPageCode.includes("<HostHeader />"), "Bookings page must mount HostHeader");
  assert.ok(hostBookingDetailPageCode.includes("<HostHeader />"), "Booking detail page must mount HostHeader");
  assert.ok(hostListingEditorCode.includes("<HostHeader"), "Listing editor must mount HostHeader");
});

runTest("HostHeader integrates with AppHeader and forwards user and divider props", () => {
  assert.ok(hostHeaderCode.includes("AppHeader"), "HostHeader must render AppHeader");
  assert.ok(hostHeaderCode.includes("user={user}"), "HostHeader must forward user prop to AppHeader");
  assert.ok(hostHeaderCode.includes("showBottomBorder={showBottomBorder}"), "HostHeader must forward showBottomBorder");
});

runTest("Host layout keeps one shared header mounted across route changes", () => {
  assert.ok(
    hostLayoutCode.includes("<HostLayoutShell>{children}</HostLayoutShell>"),
    "Host layout must own the persistent shared header shell"
  );
  assert.ok(
    hostHeaderCode.includes("<AppHeader />"),
    "The shared Host layout must render one AppHeader"
  );
  assert.ok(
    hostHeaderCode.includes("if (isManagedByLayout) return null;"),
    "Page-level HostHeader calls must not duplicate the layout header"
  );
});

runTest("Shared Host header keeps a stable height and exposes primary navigation on mobile", () => {
  assert.ok(
    appHeaderCode.includes("h-20 w-full items-center justify-between border-b-0 py-0 md:h-[88px] lg:h-[96px]"),
    "Host header height must remain fixed at each responsive breakpoint"
  );
  assert.ok(
    appHeaderCode.includes('className="grid h-11 grid-cols-4 border-t border-zinc-100 md:hidden"'),
    "Mobile Host navigation must keep four routes aligned in a fixed-height row"
  );
  assert.ok(
    appHeaderCode.includes("aria-current={tab.isActive ? \"page\" : undefined}"),
    "Mobile navigation must expose the active route accessibly"
  );
});

runTest("Messages workspace avoids a duplicate inbox title below the main Host navigation", () => {
  assert.ok(
    !hostMessagesWorkspaceCode.includes("messages_column_title"),
    "Messages inbox must not repeat the active primary navigation label as a header"
  );
  assert.ok(
    hostMessagesWorkspaceCode.includes("h-[calc(100dvh-124px)]"),
    "Mobile messages panel height must account for the shared two-row Host header"
  );
});

// -----------------------------------------------------------------------------
// 2. LOGO DESTINATION IN HOST MODE
// -----------------------------------------------------------------------------
runTest("Logo navigates to /host/today when in host mode, preserving host context", () => {
  assert.ok(
    appHeaderCode.includes('const isHostRoute = pathname?.startsWith("/host") ?? false;'),
    "AppHeader must identify whether current path is a host route"
  );
  assert.ok(
    appHeaderCode.includes('const logoHref = isHostRoute ? "/host/today" : "/";'),
    "Logo destination must route to /host/today in host mode and / in guest mode"
  );
  assert.ok(
    appHeaderCode.includes("href={logoHref}"),
    "Logo links must use dynamic logoHref rather than hardcoded '/'"
  );
});

// -----------------------------------------------------------------------------
// 3. HOST ↔ GUEST MODE SWITCH
// -----------------------------------------------------------------------------
runTest("Host mode switch allows instant transition to the main page across responsive viewports", () => {
  assert.ok(
    appHeaderCode.includes('href="/"'),
    "Mode switch must link to the main page when switching to traveling"
  );
  assert.ok(
    appHeaderCode.includes("Switch to traveling"),
    "Mode switch button must display 'Switch to traveling' text"
  );
  assert.ok(
    appHeaderCode.includes("sm:inline-flex"),
    "Switch to traveling in host mode must be visible on tablet and desktop (sm:inline-flex)"
  );
});

runTest("Host dropdown menu contains prominent mode switch for mobile & tablet users", () => {
  assert.ok(
    appHeaderCode.includes('Mode Switcher inside Host Dropdown Menu'),
    "Host dropdown menu must include a dedicated mode switcher"
  );
  assert.ok(
    appHeaderCode.includes('onClick={() => setMenuOpen(false)}'),
    "Dropdown links must close menu on click"
  );
});

// -----------------------------------------------------------------------------
// 4. NOTIFICATION CONTROL IN HEADER
// -----------------------------------------------------------------------------
runTest("Header contains accessible Notification icon with unread badge indicator", () => {
  assert.ok(
    appHeaderCode.includes('href="/profile/tab/notifications"'),
    "Notification icon must link to /profile/tab/notifications"
  );
  assert.ok(
    appHeaderCode.includes("/images/icons/Notifications.svg"),
    "Notification icon must use Notifications.svg asset"
  );
  assert.ok(
    appHeaderCode.includes("unreadCount"),
    "Header must track unread notification count"
  );
  assert.ok(
    appHeaderCode.includes("useUnreadNotificationCount"),
    "Header must read the shared unread notification count cache"
  );
  assert.ok(
    !appHeaderCode.includes('fetch("/api/v1/notifications?countOnly=true")'),
    "Header must not fetch notification counts during page initialization"
  );
  assert.ok(
    appHeaderCode.includes("unread notifications"),
    "Notification badge must have accessible aria-label"
  );
});

// -----------------------------------------------------------------------------
// 5. PROFILE / AVATAR & HOST MENU ACCESSIBILITY
// -----------------------------------------------------------------------------
runTest("Host menu displays authenticated host details and closes on Escape key or outside click", () => {
  assert.ok(
    appHeaderCode.includes('event.key === "Escape"'),
    "Header menu must close when Escape key is pressed"
  );
  assert.ok(
    appHeaderCode.includes("handleClickOutside"),
    "Header menu must close when clicking outside menu container"
  );
  assert.ok(
    appHeaderCode.includes("role || \"HOST\""),
    "Host menu header card must display role badge"
  );
  assert.ok(
    appHeaderCode.includes('window.addEventListener("homyz:toggle-menu"'),
    "Header must listen for homyz:toggle-menu event"
  );
});

// -----------------------------------------------------------------------------
// 6. PRIMARY NAVIGATION TABS (HostSubNav)
// -----------------------------------------------------------------------------
runTest("HostSubNav defines the 4 canonical host sections: Today, Calendar, Listing, Messages", () => {
  assert.ok(hostSubNavCode.includes('id: "today"'), "HostSubNav must include 'today' tab");
  assert.ok(hostSubNavCode.includes('href: "/host/today"'), "Today tab must point to /host/today");

  assert.ok(hostSubNavCode.includes('id: "calendar"'), "HostSubNav must include 'calendar' tab");
  assert.ok(hostSubNavCode.includes('href: "/host/calendar"'), "Calendar tab must point to /host/calendar");

  assert.ok(hostSubNavCode.includes('id: "listing"'), "HostSubNav must include 'listing' tab");
  assert.ok(hostSubNavCode.includes('href: listingHref'), "Listing tab must point to /host/listings");

  assert.ok(hostSubNavCode.includes('id: "messages"'), "HostSubNav must include 'messages' tab");
  assert.ok(hostSubNavCode.includes('href: "/host/messages"'), "Messages tab must point to /host/messages");
  assert.ok(!hostSubNavCode.includes('href: "/host/resolution-center"'), "Resolution Center must be available only through the host menu");
});

runTest("HostSubNav accurately resolves active tab from pathname including sub-routes and queries", () => {
  assert.ok(
    hostSubNavCode.includes('pathname === "/host/today" || pathname.startsWith("/host/today/")'),
    "Today active tab must match /host/today and subpaths"
  );
  assert.ok(
    hostSubNavCode.includes('pathname === "/host/calendar" || pathname.startsWith("/host/calendar/")'),
    "Calendar active tab must match /host/calendar and subpaths"
  );
  assert.ok(
    hostSubNavCode.includes('pathname === "/host/messages" || pathname.startsWith("/host/messages/")'),
    "Messages active tab must match /host/messages and queries"
  );
  assert.ok(
    hostSubNavCode.includes('pathname === "/host/listings" || pathname.startsWith("/host/listings/")'),
    "Listing active tab must match /host/listings and nested editor pages"
  );
});

runTest("HostSubNav Menu button dispatches homyz:toggle-menu to open header menu", () => {
  assert.ok(
    hostSubNavCode.includes('handleMenuClick'),
    "HostSubNav must have handleMenuClick handler"
  );
  assert.ok(
    hostSubNavCode.includes('window.dispatchEvent(new CustomEvent("homyz:toggle-menu"))'),
    "handleMenuClick must dispatch homyz:toggle-menu when onMenuClick is not provided"
  );
  assert.ok(
    hostSubNavCode.includes('aria-label='),
    "Menu button must contain aria-label for accessibility"
  );
});

runTest("HostSubNav mobile bottom notch gracefully positions when tab is active or inactive", () => {
  assert.ok(
    hostSubNavCode.includes('const activeTabIndex = tabs.findIndex((tab) => tab.id === activeTab);'),
    "HostSubNav must find activeTabIndex"
  );
  assert.ok(
    hostSubNavCode.includes('const hasActiveTab = activeTabIndex !== -1;'),
    "HostSubNav must check if an active tab exists"
  );
  assert.ok(
    hostSubNavCode.includes('notchX = hasActiveTab ? (activeTabIndex + 0.5) * (390 / tabs.length) : -100;'),
    "HostSubNav notch must not highlight tab 0 when no tab matches and scale concentric with tabs"
  );
});

// -----------------------------------------------------------------------------
// 7. ROLE GUARDS ACROSS HOST DASHBOARD
// -----------------------------------------------------------------------------
runTest("Host Today, Calendar, and Messages pages enforce HOST or ADMIN role", () => {
  assert.ok(
    hostTodayPageCode.includes("requirePageRole([Role.HOST, Role.ADMIN])"),
    "/host/today must require HOST or ADMIN role"
  );
  assert.ok(
    hostCalendarPageCode.includes("requirePageRole([Role.HOST, Role.ADMIN])"),
    "/host/calendar must require HOST or ADMIN role"
  );
  assert.ok(
    hostMessagesPageCode.includes("requirePageRole([Role.HOST, Role.ADMIN])"),
    "/host/messages must require HOST or ADMIN role"
  );
});

runTest("Host Bookings pages enforce HOST or ADMIN role without duplicating workspace navigation", () => {
  assert.ok(
    hostBookingsPageCode.includes("requirePageRole([Role.HOST, Role.ADMIN])"),
    "/host/bookings must require HOST or ADMIN role"
  );
  assert.ok(
    !hostBookingsPageCode.includes("HostSubNav"),
    "/host/bookings must not render the HostSubNav shortcut strip"
  );
  assert.ok(
    hostBookingDetailPageCode.includes("requirePageRole([Role.HOST, Role.ADMIN])"),
    "/host/bookings/[id] must require HOST or ADMIN role"
  );
  assert.ok(
    !hostBookingDetailPageCode.includes("HostSubNav"),
    "/host/bookings/[id] must not render the HostSubNav shortcut strip"
  );
});

runTest("Listing editor preserves host identity without duplicating shortcut navigation", () => {
  assert.ok(
    hostListingEditorCode.includes("<HostHeader user={listing.host} />"),
    "Listing editor must mount HostHeader with host identity"
  );
  assert.ok(
    !hostListingEditorCode.includes("HostSubNav"),
    "Listing editor must not mount the HostSubNav shortcut strip"
  );
});

runTest("Initial user prop in AppHeader prevents session hydration flicker", () => {
  assert.ok(
    appHeaderCode.includes("const user = session?.user ?? initialUser ?? null;"),
    "AppHeader must prioritize initialUser when session is hydrating"
  );
  assert.ok(
    appHeaderCode.includes("const sessionLoading = sessionStatus === \"loading\" && !initialUser;"),
    "AppHeader must not show loading skeleton if initialUser was provided by RSC"
  );
});

runTest("Guest menu in AppHeader maintains Gift Cards and Messages link compatibility", () => {
  assert.ok(
    appHeaderCode.includes('href="/giftcards"'),
    "Guest menu must include Gift Cards link"
  );
  assert.ok(
    appHeaderCode.includes('href="/messages"'),
    "Guest menu must link Messages to /messages"
  );
});

console.log("\n==================================================================");
console.log(`   TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
console.log("==================================================================\n");

if (passed !== total) {
  process.exit(1);
}
