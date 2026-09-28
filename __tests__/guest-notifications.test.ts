import { notificationService } from "../services/notification.service";
import { NotificationType } from "../generated/prisma/enums";
import { GUEST_NAV_ITEMS } from "../lib/profile/tab-utils";
import fs from "fs";
import path from "path";

async function runGuestNotificationTests() {
  console.log("\n=======================================================");
  console.log("   GUEST DASHBOARD NOTIFICATIONS COMPREHENSIVE SUITE   ");
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

  // Test 1: Navigation Item & Tab Route
  const notifNavItem = GUEST_NAV_ITEMS.find((item) => item.id === "notifications");
  assert(Boolean(notifNavItem), "GUEST_NAV_ITEMS must contain 'notifications'");
  assert(
    notifNavItem?.href === "/profile/tab/notifications",
    "Notifications href must be '/profile/tab/notifications'",
  );
  assert(
    notifNavItem?.image === "/images/icons/Notifications.svg",
    "Notifications image must be '/images/icons/Notifications.svg'",
  );

  // Test 2: Notification Service Functions exist
  assert(typeof notificationService.create === "function", "notificationService.create must be a function");
  assert(typeof notificationService.listForUser === "function", "notificationService.listForUser must be a function");
  assert(typeof notificationService.markAsRead === "function", "notificationService.markAsRead must be a function");
  assert(typeof notificationService.markAsUnread === "function", "notificationService.markAsUnread must be a function");
  assert(typeof notificationService.markAllAsRead === "function", "notificationService.markAllAsRead must be a function");
  assert(typeof notificationService.getUnreadCount === "function", "notificationService.getUnreadCount must be a function");

  // Test 3: Supported Notification Types in Schema
  assert(
    NotificationType.BOOKING === "BOOKING" &&
    NotificationType.MESSAGE === "MESSAGE" &&
    NotificationType.PROMOTION === "PROMOTION" &&
    NotificationType.SYSTEM === "SYSTEM",
    "NotificationType must support BOOKING, MESSAGE, PROMOTION, and SYSTEM",
  );

  // Test 4: UI Component Exists and Supports Required Notification Elements
  const uiFilePath = path.join(process.cwd(), "components/profile/notifications-view.tsx");
  assert(fs.existsSync(uiFilePath), "components/profile/notifications-view.tsx must exist");
  const uiContent = fs.readFileSync(uiFilePath, "utf8");

  assert(uiContent.includes("Notifications"), "UI must render 'Notifications' heading");
  assert(uiContent.includes("Mark all as read"), "UI must support 'Mark all as read' action");
  assert(uiContent.includes("NotificationType.BOOKING"), "UI must support BOOKING category");
  assert(uiContent.includes("NotificationType.MESSAGE"), "UI must support MESSAGE category");
  assert(uiContent.includes("NotificationType.PROMOTION"), "UI must support PROMOTION category");
  assert(uiContent.includes("NotificationType.SYSTEM"), "UI must support SYSTEM category");
  assert(uiContent.includes("NotificationsSkeleton"), "UI must use NotificationsSkeleton for loading");
  assert(uiContent.includes("No notifications found"), "UI must render clear empty state");
  assert(uiContent.includes("Retry"), "UI must render retry button in error state");
  assert(uiContent.includes("router.push"), "UI must navigate to related context on click");

  // Test 5: Server Actions File Exists with Security Guards
  const actionsFilePath = path.join(process.cwd(), "actions/notification/notifications.ts");
  assert(fs.existsSync(actionsFilePath), "actions/notification/notifications.ts must exist");
  const actionsContent = fs.readFileSync(actionsFilePath, "utf8");

  assert(actionsContent.includes("getSessionUser"), "Server actions must authenticate with getSessionUser");
  assert(actionsContent.includes("AppError.unauthorized"), "Server actions must reject unauthenticated callers");
  assert(actionsContent.includes("markNotificationReadAction"), "markNotificationReadAction must exist");
  assert(actionsContent.includes("markAllNotificationsReadAction"), "markAllNotificationsReadAction must exist");

  // Test 6: REST API Route Exists
  const apiRoutePath = path.join(process.cwd(), "app/api/v1/notifications/route.ts");
  assert(fs.existsSync(apiRoutePath), "app/api/v1/notifications/route.ts must exist");
  const apiRouteContent = fs.readFileSync(apiRoutePath, "utf8");
  assert(apiRouteContent.includes("requireApiAuth"), "API route must authenticate callers");

  const patchRoutePath = path.join(process.cwd(), "app/api/v1/notifications/[id]/read/route.ts");
  assert(fs.existsSync(patchRoutePath), "app/api/v1/notifications/[id]/read/route.ts must exist");

  // Test 7: Profile Loader Integration
  const loaderPath = path.join(process.cwd(), "lib/profile/profile-loader.ts");
  const loaderContent = fs.readFileSync(loaderPath, "utf8");
  assert(loaderContent.includes("needsNotifications"), "profile-loader must handle needsNotifications");
  assert(loaderContent.includes("initialNotifications"), "profile-loader must return initialNotifications");

  // Test 8: Booking Service Integration
  const bookingServicePath = path.join(process.cwd(), "services/booking.service.ts");
  const bookingServiceContent = fs.readFileSync(bookingServicePath, "utf8");
  assert(
    bookingServiceContent.includes("notificationService.create"),
    "bookingService must trigger notifications on booking lifecycle events",
  );

  console.log("\n=======================================================");
  console.log(` RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runGuestNotificationTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});

