import { test, describe } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

describe("Host Menu Notification Center — In-Drawer Experience", () => {
  const drawerFilePath = path.join(
    process.cwd(),
    "components/host/navigation/host-navigation-drawer.tsx"
  );
  const notifComponentFilePath = path.join(
    process.cwd(),
    "components/host/navigation/host-drawer-notifications.tsx"
  );
  const hostHeaderFilePath = path.join(
    process.cwd(),
    "components/host/host-header.tsx"
  );

  test("Phase 1: Required files and modular components exist", () => {
    assert.ok(fs.existsSync(drawerFilePath), "host-navigation-drawer.tsx must exist");
    assert.ok(fs.existsSync(notifComponentFilePath), "host-drawer-notifications.tsx must exist");
    assert.ok(fs.existsSync(hostHeaderFilePath), "host-header.tsx must exist");

    const drawerContent = fs.readFileSync(drawerFilePath, "utf8");
    assert.ok(drawerContent.includes("export function HostNavigationDrawer"), "Must export HostNavigationDrawer");
    assert.ok(drawerContent.includes("export function DrawerHeader"), "Must export DrawerHeader");
    assert.ok(drawerContent.includes("export function DrawerProfile"), "Must export DrawerProfile");
    assert.ok(drawerContent.includes("export function HostResourcesCard"), "Must export HostResourcesCard");
    assert.ok(drawerContent.includes("export function DrawerNavigation"), "Must export DrawerNavigation");
    assert.ok(drawerContent.includes("export function DrawerFooter"), "Must export DrawerFooter");

    const notifContent = fs.readFileSync(notifComponentFilePath, "utf8");
    assert.ok(notifContent.includes("export function HostDrawerNotifications"), "Must export HostDrawerNotifications");
  });

  test("Phase 1 & GEMINI.md: Strict adherence to typography rules (0 font-bold/font-semibold/<b>/<strong>)", () => {
    const drawerContent = fs.readFileSync(drawerFilePath, "utf8");
    const notifContent = fs.readFileSync(notifComponentFilePath, "utf8");

    const checkTypography = (content: string, filename: string) => {
      const boldMatches = content.match(/font-bold|font-semibold/g) || [];
      assert.strictEqual(
        boldMatches.length,
        0,
        `Found forbidden font weights in ${filename}: ${boldMatches.join(", ")}`
      );
      const tagMatches = content.match(/<b\b|<strong\b/g) || [];
      assert.strictEqual(
        tagMatches.length,
        0,
        `Found forbidden <b> or <strong> tags in ${filename}`
      );
    };

    checkTypography(drawerContent, "host-navigation-drawer.tsx");
    checkTypography(notifContent, "host-drawer-notifications.tsx");
  });

  test("Phase 2 & Phase 8: Coordinated view state inside the same drawer (MENU <-> NOTIFICATIONS)", () => {
    const drawerContent = fs.readFileSync(drawerFilePath, "utf8");

    // Coordinated state
    assert.ok(drawerContent.includes('activeView, setActiveView] = useState'), "Must maintain activeView state");
    assert.ok(drawerContent.includes('"MENU"'), "Must support MENU view");
    assert.ok(drawerContent.includes('"NOTIFICATIONS"'), "Must support NOTIFICATIONS view");

    // Bell click opens notifications
    assert.ok(drawerContent.includes("handleOpenNotifications"), "Must have handleOpenNotifications");
    assert.ok(drawerContent.includes('setActiveView("NOTIFICATIONS")'), "handleOpenNotifications must switch to NOTIFICATIONS view");

    // Back button returns to menu
    assert.ok(drawerContent.includes("handleBackToMenu"), "Must have handleBackToMenu");
    assert.ok(drawerContent.includes('setActiveView("MENU")'), "handleBackToMenu must switch back to MENU view");

    // Scroll position preservation
    assert.ok(drawerContent.includes("savedMenuScrollTopRef"), "Must track savedMenuScrollTopRef");
    assert.ok(drawerContent.includes("menuScrollRef"), "Must reference menuScrollRef container");

    // Reopening starts in MENU view
    assert.ok(drawerContent.includes('setActiveView("MENU")'), "Must reset to MENU view when closed");
  });

  test("Phase 3: Airbnb-inspired DrawerHeader with Back button and unread count", () => {
    const drawerContent = fs.readFileSync(drawerFilePath, "utf8");

    // Header supports view prop
    assert.ok(drawerContent.includes("view?: HostDrawerView"), "DrawerHeaderProps must accept view");
    assert.ok(drawerContent.includes("onBackToMenu?: () => void"), "DrawerHeaderProps must accept onBackToMenu");

    // In NOTIFICATIONS view: Back button + Notifications title
    assert.ok(drawerContent.includes('aria-label="Back to host menu"'), "Must include Back to host menu button");
    assert.ok(drawerContent.includes(">Notifications</h2>") || drawerContent.includes("Notifications"), "Must render Notifications heading");

    // In MENU view: Menu title + notification bell
    assert.ok(drawerContent.includes(">Menu</h2>") || drawerContent.includes("Menu"), "Must render Menu heading");
    assert.ok(drawerContent.includes("unread notifications"), "Must support unread notifications indicator");
  });

  test("Phase 4: Notification functionality & read/unread interactions", () => {
    const notifContent = fs.readFileSync(notifComponentFilePath, "utf8");

    // Integration with existing server actions & stores
    assert.ok(notifContent.includes("getNotificationsAction"), "Must call getNotificationsAction");
    assert.ok(notifContent.includes("markNotificationReadAction"), "Must support markNotificationReadAction");
    assert.ok(notifContent.includes("markAllNotificationsReadAction"), "Must support markAllNotificationsReadAction");
    assert.ok(notifContent.includes("publishUnreadNotificationCount"), "Must update global unread count store");

    // Mark all as read button
    assert.ok(notifContent.includes("Mark all as read"), "Must have 'Mark all as read' button");

    // Notification click navigation
    assert.ok(notifContent.includes("handleNotificationClick"), "Must handle notification click");
    assert.ok(
      notifContent.includes("resolveHostNotificationDestination") ||
        notifContent.includes("resolveDestination"),
      "Must resolve correct destination URL"
    );
    assert.ok(notifContent.includes("onClose()"), "Must close drawer upon navigation");
  });

  test("Phase 5: Loading, Empty, and Error states", () => {
    const notifContent = fs.readFileSync(notifComponentFilePath, "utf8");

    // Skeleton loading state
    assert.ok(notifContent.includes("animate-pulse"), "Must include skeleton pulse animation");
    assert.ok(notifContent.includes('aria-label="Loading notifications"'), "Must announce loading status");

    // Empty state
    assert.ok(
      notifContent.includes("You're all caught up") ||
        notifContent.includes("You&apos;re all caught up"),
      "Must display 'You're all caught up'"
    );
    assert.ok(notifContent.includes("No new notifications right now"), "Must display empty description");

    // Error state
    assert.ok(notifContent.includes("Unable to load notifications"), "Must show error heading");
    assert.ok(notifContent.includes("Retry"), "Must provide Retry button");
  });

  test("Phase 6: Pagination and performance optimization", () => {
    const notifContent = fs.readFileSync(notifComponentFilePath, "utf8");
    const drawerContent = fs.readFileSync(drawerFilePath, "utf8");

    // Pagination
    assert.ok(notifContent.includes("handleLoadMore"), "Must support loading more notifications");
    assert.ok(notifContent.includes("take: 20"), "Must fetch in bounded pages (take: 20)");

    // Stable keys
    assert.ok(notifContent.includes("key={item.id}"), "Must use stable notification IDs as React keys");

    // Prevent component unmounting / refetch loops when switching views
    assert.ok(drawerContent.includes("<HostDrawerNotifications"), "Must embed HostDrawerNotifications inside drawer");
    assert.ok(notifContent.includes("hasFetchedRef"), "Must cache fetched state to avoid duplicate requests");
  });

  test("Phase 7: Responsive drawer styling and mobile ergonomics", () => {
    const drawerContent = fs.readFileSync(drawerFilePath, "utf8");
    const notifContent = fs.readFileSync(notifComponentFilePath, "utf8");

    // Desktop & mobile drawer widths
    assert.ok(drawerContent.includes("w-full md:w-[400px]"), "Drawer must be full width on mobile and 400px on desktop");
    assert.ok(drawerContent.includes("h-[100dvh]"), "Drawer must use full dynamic viewport height");

    // Safe area padding for mobile navigation
    assert.ok(notifContent.includes("env(safe-area-inset-bottom)"), "Notifications list must respect device safe areas");
  });

  test("Phase 9: Strict preservation of all existing Host Menu sections", () => {
    const drawerContent = fs.readFileSync(drawerFilePath, "utf8");

    const requiredMenuElements = [
      "DrawerProfile",
      "HostResourcesCard",
      "Switch to Travelling",
      "/host/dashboard",
      "/host/earnings",
      "/host/insights",
      "/host/support",
      "/host/account-settings",
      "Languages & currency",
      "/host/listings/new",
      "/host/refer",
      "DrawerFooter",
      "Log out",
    ];

    for (const elem of requiredMenuElements) {
      assert.ok(drawerContent.includes(elem), `Menu must preserve: ${elem}`);
    }
  });
});
