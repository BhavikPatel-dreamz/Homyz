import { test, describe } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

describe("Host Navigation Drawer — Airbnb Inspired Redesign & Verification", () => {
  const drawerFilePath = path.join(
    process.cwd(),
    "components/host/navigation/host-navigation-drawer.tsx"
  );
  const headerFilePath = path.join(
    process.cwd(),
    "components/dashboard/app-header.tsx"
  );
  const hostHeaderFilePath = path.join(
    process.cwd(),
    "components/host/host-header.tsx"
  );

  test("Source files exist", () => {
    assert.ok(fs.existsSync(drawerFilePath), "host-navigation-drawer.tsx should exist");
    assert.ok(fs.existsSync(headerFilePath), "app-header.tsx should exist");
    assert.ok(fs.existsSync(hostHeaderFilePath), "host-header.tsx should exist");
  });

  test("Strict adherence to GEMINI.md typography: 0 instances of font-bold or font-semibold", () => {
    const drawerContent = fs.readFileSync(drawerFilePath, "utf8");
    const boldMatches = drawerContent.match(/font-bold|font-semibold/g) || [];
    assert.strictEqual(
      boldMatches.length,
      0,
      `Found forbidden font weights in host-navigation-drawer.tsx: ${boldMatches.join(", ")}`
    );

    const tagMatches = drawerContent.match(/<b\b|<strong\b/g) || [];
    assert.strictEqual(
      tagMatches.length,
      0,
      `Found forbidden <b> or <strong> tags in host-navigation-drawer.tsx`
    );

    const headerContent = fs.readFileSync(headerFilePath, "utf8");
    const headerBoldMatches = headerContent.match(/font-bold|font-semibold/g) || [];
    assert.strictEqual(
      headerBoldMatches.length,
      0,
      `Found forbidden font weights in app-header.tsx: ${headerBoldMatches.join(", ")}`
    );
  });

  test("Drawer exports all required modular components", () => {
    const content = fs.readFileSync(drawerFilePath, "utf8");
    assert.ok(content.includes("export function HostNavigationDrawer"), "Must export HostNavigationDrawer");
    assert.ok(content.includes("export function DrawerHeader"), "Must export DrawerHeader");
    assert.ok(content.includes("export function DrawerProfile"), "Must export DrawerProfile");
    assert.ok(content.includes("export function HostResourcesCard"), "Must export HostResourcesCard");
    assert.ok(content.includes("export function DrawerNavigation"), "Must export DrawerNavigation");
    assert.ok(content.includes("export function DrawerFooter"), "Must export DrawerFooter");
  });

  test("DrawerHeader matches Airbnb specifications", () => {
    const content = fs.readFileSync(drawerFilePath, "utf8");
    // Heading Menu
    assert.ok(content.includes(">Menu</h2>") || content.includes("Menu"), "Header must include Menu title");
    // Notifications icon with unread badge support
    assert.ok(content.includes("unread notifications"), "Header must support unread notifications");
    // Circular Close (X) button
    assert.ok(content.includes("Close menu"), "Header must include Close menu button");
  });

  test("DrawerProfile displays user details dynamically in softly styled card", () => {
    const content = fs.readFileSync(drawerFilePath, "utf8");
    assert.ok(content.includes("displayName"), "Profile card must render display name");
    assert.ok(content.includes("displayEmail"), "Profile card must render display email");
    assert.ok(content.includes("roleName"), "Profile card must render role badge");
    assert.ok(content.includes("rounded-2xl"), "Profile card must use rounded-2xl corners");
  });

  test("HostResourcesCard matches Airbnb 'New to hosting?' promotional banner", () => {
    const content = fs.readFileSync(drawerFilePath, "utf8");
    assert.ok(content.includes("New to hosting?"), "Must include 'New to hosting?' heading");
    assert.ok(content.includes("Get started"), "Must include 'Get started' button");
    assert.ok(content.includes("/host/onboarding"), "Get started must link to host onboarding wizard");
  });

  test("DrawerNavigation includes all required host routes and outline icons", () => {
    const content = fs.readFileSync(drawerFilePath, "utf8");
    const requiredRoutes = [
      "/host/dashboard",
      "/host/earnings",
      "/host/insights",
      "/host/support",
      "/profile",
      "/profile/tab/notifications",
      "/host/account-settings",
      "/host/listings/new",
      "/host/co-host",
      "/host/refer",
      "/admin",
    ];

    for (const route of requiredRoutes) {
      assert.ok(content.includes(route), `DrawerNavigation must include route: ${route}`);
    }

    assert.ok(content.includes("onOpenLanguagesCurrency"), "Must include Languages & currency handler");
  });

  test("DrawerFooter provides Logout with icon and clean redirection", () => {
    const content = fs.readFileSync(drawerFilePath, "utf8");
    assert.ok(content.includes("Log out"), "Footer must include 'Log out'");
    assert.ok(content.includes("signOut"), "Footer must trigger signOut");
  });

  test("Drawer uses Airbnb right-side sliding animation, overlay and portal", () => {
    const content = fs.readFileSync(drawerFilePath, "utf8");
    // Transform classes
    assert.ok(content.includes("translate-x-full"), "Must support translate-x-full when closed");
    assert.ok(content.includes("translate-x-0"), "Must support translate-x-0 when open");
    // Transition easing & duration
    assert.ok(
      content.includes("cubic-bezier(0.22, 1, 0.36, 1)"),
      "Must use smooth 320ms cubic-bezier transition"
    );
    // Dark translucent backdrop overlay
    assert.ok(content.includes("bg-black/35"), "Must have dark translucent overlay");
    // Rounded-l-3xl drawer
    assert.ok(content.includes("rounded-l-3xl"), "Must have rounded-l-3xl drawer styling");
    // Body scroll lock
    assert.ok(content.includes("lockBodyScroll"), "Must lock body scroll while open");
    // Portal to body
    assert.ok(content.includes("createPortal"), "Must portal drawer to document.body");
  });

  test("AppHeader integrates HostNavigationDrawer exclusively for host routes", () => {
    const content = fs.readFileSync(headerFilePath, "utf8");
    assert.ok(
      content.includes("<HostNavigationDrawer"),
      "AppHeader must render HostNavigationDrawer"
    );
    assert.ok(
      content.includes("isHosting ?"),
      "AppHeader must conditionally render drawer only when isHosting is true"
    );
    // Preserves client / guest dropdown
    assert.ok(
      content.includes("TRAVELING MENU"),
      "AppHeader must retain traveling dropdown for non-host routes"
    );
  });

  test("Drawer closes on cross icon click, backdrop click, and Escape key", () => {
    const content = fs.readFileSync(drawerFilePath, "utf8");
    // Cross icon calls onClose
    assert.ok(
      content.includes("<DrawerHeader\n          onClose={onClose}") ||
        content.includes("<DrawerHeader onClose={onClose}"),
      "DrawerHeader must receive onClose directly"
    );
    // Backdrop overlay calls onClose
    assert.ok(
      content.includes("onClick={onClose}"),
      "Backdrop overlay must trigger onClose when clicked"
    );
    // Escape key calls onClose
    assert.ok(
      content.includes('e.key === "Escape"'),
      "Escape key listener must be wired up"
    );
    // Drawer aside stops click propagation so clicks inside do not close
    assert.ok(
      content.includes("onClick={(e) => e.stopPropagation()}"),
      "Aside container must stop click propagation"
    );
  });
});

