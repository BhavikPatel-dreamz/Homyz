import { NotificationType } from "@/generated/prisma/enums";

export interface NotificationLike {
  id?: string;
  type?: string | NotificationType | null;
  title?: string | null;
  message?: string | null;
  entityId?: string | null;
  entityType?: string | null;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
}

export type NotificationContext = "HOST" | "TRAVELLER" | "ADMIN" | "SYSTEM";

export type NotificationNavigationMode = "host" | "guest" | "admin";

export interface NotificationRouteResult {
  targetUrl: string;
  context: NotificationContext;
}

/**
 * Valid Host route prefixes in Homyz.
 * Any destination returned by resolveHostNotificationDestination must start with
 * one of these approved paths to guarantee that Hosting mode and Host layouts are preserved.
 */
const VALID_HOST_SECTIONS = [
  "/host/bookings",
  "/host/today",
  "/host/calendar",
  "/host/messages",
  "/host/listings",
  "/host/earnings",
  "/host/insights",
  "/host/reviews",
  "/host/support",
  "/host/resolution-center",
  "/host/account-settings",
  "/host/co-host",
  "/host/refer",
  "/host/dashboard",
  "/host/onboarding",
  "/host/operations",
] as const;

/**
 * Safely extracts a clean string from input or returns undefined.
 */
function cleanIdentifier(val: unknown): string | undefined {
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed.length > 0 && !trimmed.includes("/") && !trimmed.includes("\\")) {
      return trimmed;
    }
  }
  return undefined;
}

/**
 * Checks whether a given path is an open redirect or external URL.
 */
function isUnsafeUrl(path: string): boolean {
  if (!path || typeof path !== "string") return true;
  const trimmed = path.trim();
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("data:") ||
    trimmed.includes("\\") ||
    trimmed.includes("\0") ||
    !trimmed.startsWith("/")
  );
}

/**
 * Extracts param from regex match on link string.
 */
function extractParamFromLink(link: string, regex: RegExp): string | undefined {
  if (!link) return undefined;
  const match = link.match(regex);
  return match && match[1] ? cleanIdentifier(match[1]) : undefined;
}

/**
 * Extracts query param from link string.
 */
function extractQueryParam(link: string, paramName: string): string | undefined {
  if (!link || !link.includes("?")) return undefined;
  try {
    const queryStr = link.split("?")[1];
    const searchParams = new URLSearchParams(queryStr);
    const value = searchParams.get(paramName);
    return value ? cleanIdentifier(value) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Determines whether notification signals a Saudi license or listing regulation.
 */
function isSaudiLicenseOrRegulation(
  entityType: string,
  title: string,
  message: string,
  rawLink: string,
): boolean {
  return (
    entityType.includes("license") ||
    entityType.includes("regulation") ||
    title.includes("license") ||
    title.includes("regulation") ||
    message.includes("license") ||
    message.includes("regulation") ||
    rawLink.includes("/regulations") ||
    rawLink.includes("/license")
  );
}

/**
 * Centralized Route & Context Resolver for Notifications.
 *
 * Evaluates the business context of a notification (recipient role, entity type,
 * title/message intent, resource identifiers) to determine whether the notification
 * belongs to HOST, TRAVELLER, ADMIN, or SYSTEM, and resolves the safe target URL.
 *
 * Supports dual-role users seamlessly:
 * - A Host viewing Traveller notifications is directed to Traveller booking/trip details.
 * - A Traveller viewing Host notifications is directed to Host reservation/management screens.
 */
export function resolveNotificationRoute(
  notification: NotificationLike,
  options?: { currentMode?: NotificationNavigationMode },
): NotificationRouteResult {
  const metadata = notification.metadata || {};
  const entityType = String(notification.entityType || "").toLowerCase();
  const rawType = String(notification.type || "").toUpperCase();
  const rawLink = typeof notification.link === "string" ? notification.link.trim() : "";
  const title = String(notification.title || "").toLowerCase();
  const message = String(notification.message || "").toLowerCase();

  const role = String(metadata.role || metadata.recipientRole || "").toLowerCase();

  // Resource identifier extraction
  const bookingId =
    cleanIdentifier(metadata.bookingId) ||
    cleanIdentifier(metadata.id) ||
    (entityType === "host_booking" || entityType === "booking"
      ? cleanIdentifier(notification.entityId)
      : undefined) ||
    extractParamFromLink(rawLink, /\/bookings\/([^/?#]+)/) ||
    extractParamFromLink(rawLink, /\/host\/bookings\/([^/?#]+)/);

  const conversationId =
    cleanIdentifier(metadata.conversationId) ||
    (entityType === "conversation" || entityType === "host_conversation"
      ? cleanIdentifier(notification.entityId)
      : undefined) ||
    extractQueryParam(rawLink, "id") ||
    extractQueryParam(rawLink, "conversationId") ||
    extractParamFromLink(rawLink, /\/messages\/([^/?#]+)/);

  const listingId =
    cleanIdentifier(metadata.listingId) ||
    (entityType === "listing" || entityType.includes("license") || entityType.includes("regulation")
      ? cleanIdentifier(notification.entityId)
      : undefined) ||
    extractParamFromLink(rawLink, /\/listings\/([^/?#]+)/) ||
    extractParamFromLink(rawLink, /\/host\/listings\/([^/?#]+)/);

  const disputeId =
    cleanIdentifier(metadata.disputeId) ||
    (entityType.startsWith("dispute") ? cleanIdentifier(notification.entityId) : undefined) ||
    extractParamFromLink(rawLink, /\/resolution-center\/([^/?#]+)/) ||
    extractQueryParam(rawLink, "disputeId");

  const caseId =
    cleanIdentifier(metadata.caseId) ||
    cleanIdentifier(metadata.supportCaseId) ||
    (entityType === "support_case" ? cleanIdentifier(notification.entityId) : undefined) ||
    extractQueryParam(rawLink, "caseId") ||
    extractParamFromLink(rawLink, /\/support\/cases\/([^/?#]+)/);

  const transactionId =
    cleanIdentifier(metadata.transactionId) ||
    cleanIdentifier(metadata.payoutId) ||
    extractParamFromLink(rawLink, /\/transactions\/([^/?#]+)/);

  const reviewId =
    cleanIdentifier(metadata.reviewId) ||
    extractParamFromLink(rawLink, /\/reviews\/([^/?#]+)/);

  const isLicense = isSaudiLicenseOrRegulation(entityType, title, message, rawLink);

  // ── 1. CLASSIFY CONTEXT ──────────────────────────────────────────────────
  let context: NotificationContext;

  if (role === "admin" || entityType.startsWith("admin") || rawLink.startsWith("/admin/")) {
    context = "ADMIN";
  } else if (role === "guest" || role === "traveller") {
    context = "TRAVELLER";
  } else if (role === "host") {
    context = "HOST";
  } else if (
    entityType === "host_booking" ||
    entityType === "host_conversation" ||
    entityType.startsWith("listing") ||
    isLicense ||
    entityType.includes("payout") ||
    entityType.includes("expense") ||
    entityType.includes("superhost") ||
    entityType.includes("guest_favorite") ||
    entityType.includes("pricing_availability") ||
    entityType.includes("co-host")
  ) {
    context = "HOST";
  } else if (
    // Host title / message heuristics
    title.includes("booking request:") ||
    title.includes("new booking request") ||
    title.includes("new reservation") ||
    title.includes("reservation request") ||
    title.includes("cancelled by guest") ||
    title.includes("guest message") ||
    title.includes("inquiry for") ||
    title.includes("comparable price") ||
    title.includes("available nights") ||
    title.includes("available weekend") ||
    title.includes("payout") ||
    message.includes("requested to book") ||
    message.includes("a guest cancelled") ||
    Boolean(metadata.guestId)
  ) {
    context = "HOST";
  } else if (
    // Traveller title / message heuristics
    title.includes("booking request submitted") ||
    title.includes("booking request declined") ||
    title.includes("your trip") ||
    title.includes("check-in reminder") ||
    title.includes("checkout reminder") ||
    message.includes("your booking request for") ||
    message.includes("your reservation for") ||
    message.includes("your stay at") ||
    message.includes("your refund") ||
    Boolean(metadata.hostId)
  ) {
    context = "TRAVELLER";
  } else if (rawLink.startsWith("/host/")) {
    context = "HOST";
  } else if (
    rawLink.startsWith("/bookings/") ||
    rawLink.startsWith("/profile/tab/upcoming") ||
    rawLink.startsWith("/profile/tab/past")
  ) {
    // If in host mode without role and no traveller cues, treat as host
    context = options?.currentMode === "host" ? "HOST" : "TRAVELLER";
  } else if (options?.currentMode === "host") {
    context = "HOST";
  } else if (rawType === NotificationType.PROMOTION || rawType === NotificationType.SYSTEM) {
    context = "SYSTEM";
  } else {
    context = "TRAVELLER";
  }

  // ── 2. RESOLVE TARGET URL ACCORDING TO CONTEXT ─────────────────────────────
  let targetUrl: string;

  if (context === "HOST") {
    targetUrl = resolveHostPath({
      rawLink,
      entityType,
      rawType,
      metadata,
      bookingId,
      conversationId,
      listingId,
      disputeId,
      caseId,
      transactionId,
      reviewId,
      isLicense,
    });
  } else if (context === "TRAVELLER") {
    targetUrl = resolveTravellerPath({
      rawLink,
      rawType,
      bookingId,
      conversationId,
      metadata,
    });
  } else if (context === "ADMIN") {
    targetUrl =
      !isUnsafeUrl(rawLink) && rawLink.startsWith("/admin")
        ? rawLink
        : "/admin";
  } else {
    // SYSTEM context
    targetUrl =
      !isUnsafeUrl(rawLink) && rawLink.startsWith("/") && !rawLink.startsWith("//")
        ? rawLink
        : "/profile/tab/notifications";
  }

  return { targetUrl, context };
}

/**
 * Resolves safe Host URL. Guarantees prefix /host/* to preserve Hosting mode.
 */
function resolveHostPath(params: {
  rawLink: string;
  entityType: string;
  rawType: string;
  metadata: Record<string, unknown>;
  bookingId?: string;
  conversationId?: string;
  listingId?: string;
  disputeId?: string;
  caseId?: string;
  transactionId?: string;
  reviewId?: string;
  isLicense: boolean;
}): string {
  const {
    rawLink,
    entityType,
    rawType,
    metadata,
    bookingId,
    conversationId,
    listingId,
    disputeId,
    caseId,
    transactionId,
    reviewId,
    isLicense,
  } = params;

  // 1. Direct valid Host link check
  if (rawLink && !isUnsafeUrl(rawLink) && rawLink.startsWith("/host/")) {
    if (isLicense && listingId) {
      return `/host/listings/${encodeURIComponent(listingId)}/regulations`;
    }
    const isApproved = VALID_HOST_SECTIONS.some(
      (prefix) => rawLink === prefix || rawLink.startsWith(`${prefix}/`) || rawLink.startsWith(`${prefix}?`),
    );
    if (isApproved) {
      return rawLink;
    }
  }

  // 2. Bookings
  const isBookingContext =
    rawType === NotificationType.BOOKING ||
    entityType.includes("booking") ||
    rawLink.includes("/bookings") ||
    rawLink.includes("/profile/tab/upcoming") ||
    rawLink.includes("/profile/tab/past");

  if (isBookingContext && !disputeId && !caseId) {
    if (bookingId) {
      return `/host/bookings/${encodeURIComponent(bookingId)}`;
    }
    const status = String(metadata.status || "").toUpperCase();
    if (status === "PENDING" || rawLink.includes("tab=pending")) {
      return "/host/today?tab=pending";
    }
    if (
      status === "CANCELLED" ||
      rawLink.includes("tab=cancelled") ||
      rawLink.includes("tab/past") ||
      rawLink.includes("/past")
    ) {
      return "/host/today?tab=cancelled";
    }
    return "/host/today?tab=upcoming";
  }

  // 3. Messages
  const isMessageContext =
    rawType === NotificationType.MESSAGE ||
    entityType.includes("conversation") ||
    entityType.includes("message") ||
    rawLink.includes("/messages");

  if (isMessageContext) {
    if (conversationId) {
      return `/host/messages?id=${encodeURIComponent(conversationId)}`;
    }
    return "/host/messages";
  }

  // 4. Disputes / Resolution Center
  const isDisputeContext =
    disputeId ||
    entityType.includes("dispute") ||
    entityType.includes("resolution") ||
    rawLink.includes("/resolution-center") ||
    rawLink.includes("view=direct");

  if (isDisputeContext) {
    if (disputeId) {
      return `/host/resolution-center/${encodeURIComponent(disputeId)}`;
    }
    if (caseId) {
      return `/host/resolution-center/direct?caseId=${encodeURIComponent(caseId)}`;
    }
    return "/host/resolution-center";
  }

  // 5. Calendar
  if (
    entityType.includes("calendar") ||
    entityType.includes("availability") ||
    entityType.includes("weekend") ||
    rawLink.includes("/calendar")
  ) {
    if (listingId) {
      return `/host/calendar?listingId=${encodeURIComponent(listingId)}`;
    }
    return "/host/calendar";
  }

  // 6. Support
  if (caseId || entityType.includes("support") || rawLink.includes("/support") || rawLink.includes("/profile/reports")) {
    if (caseId) {
      return `/host/support?caseId=${encodeURIComponent(caseId)}`;
    }
    return "/host/support";
  }

  // 7. Listings & Regulations
  if (listingId || entityType.includes("listing") || isLicense || rawLink.includes("/listings")) {
    if (listingId) {
      if (isLicense) {
        return `/host/listings/${encodeURIComponent(listingId)}/regulations`;
      }
      return `/host/listings/${encodeURIComponent(listingId)}`;
    }
    return "/host/listings";
  }

  // 8. Financials & Payouts
  if (
    transactionId ||
    entityType.includes("payout") ||
    entityType.includes("expense") ||
    entityType.includes("tax") ||
    entityType.includes("earning") ||
    rawLink.includes("/earnings") ||
    rawLink.includes("/payout")
  ) {
    if (transactionId) {
      return `/host/earnings/transactions/${encodeURIComponent(transactionId)}`;
    }
    if (entityType.includes("tax") || rawLink.includes("/tax")) {
      return "/host/account-settings/taxes";
    }
    if (entityType.includes("payout-method") || rawLink.includes("/payouts")) {
      return "/host/account-settings/payouts";
    }
    return "/host/earnings";
  }

  // 9. Reviews & Insights
  if (
    reviewId ||
    entityType.includes("review") ||
    entityType.includes("superhost") ||
    entityType.includes("performance") ||
    entityType.includes("guest_favorite") ||
    rawLink.includes("/insights")
  ) {
    if (reviewId) {
      return `/host/insights/reviews/${encodeURIComponent(reviewId)}`;
    }
    if (entityType.includes("superhost")) {
      return "/host/insights/superhost";
    }
    if (entityType.includes("guest_favorite")) {
      return listingId ? `/host/listings/${encodeURIComponent(listingId)}` : "/host/dashboard";
    }
    return "/host/insights";
  }

  // 10. Refer, Co-Host, Account Settings
  if (entityType.includes("referral") || rawLink.includes("/refer") || rawLink.includes("/invite")) {
    return "/host/refer";
  }
  if (entityType.includes("co-host") || rawLink.includes("/co-host")) {
    return "/host/co-host";
  }
  if (
    entityType.includes("profile") ||
    rawLink.includes("/profile") ||
    rawLink.includes("/travel-profile") ||
    rawLink.includes("/account")
  ) {
    return "/host/account-settings";
  }

  return "/host/today";
}

/**
 * Resolves safe Traveller URL.
 */
function resolveTravellerPath(params: {
  rawLink: string;
  rawType: string;
  bookingId?: string;
  conversationId?: string;
  metadata: Record<string, unknown>;
}): string {
  const { rawLink, rawType, bookingId, conversationId, metadata } = params;

  // 1. Direct safe traveller link
  if (
    rawLink &&
    !isUnsafeUrl(rawLink) &&
    !rawLink.startsWith("/host/") &&
    !rawLink.startsWith("/admin/")
  ) {
    if (
      rawLink.startsWith("/bookings/") ||
      rawLink.startsWith("/messages") ||
      rawLink.startsWith("/profile/")
    ) {
      return rawLink;
    }
  }

  // 2. Bookings
  if (rawType === NotificationType.BOOKING || bookingId) {
    if (bookingId) {
      return `/bookings/${encodeURIComponent(bookingId)}`;
    }
    const status = String(metadata.status || "").toUpperCase();
    if (status === "CANCELLED" || rawLink.includes("tab=past") || rawLink.includes("/past")) {
      return "/profile/tab/past";
    }
    return "/profile/tab/upcoming";
  }

  // 3. Messages
  if (rawType === NotificationType.MESSAGE || conversationId) {
    if (conversationId) {
      return `/messages?id=${encodeURIComponent(conversationId)}`;
    }
    return "/messages";
  }

  return "/profile/tab/upcoming";
}

/**
 * Centralized Host Notification Destination Resolver.
 *
 * Guarantees that EVERY Host-origin or Host-audience notification resolves to a
 * valid, authorized Host screen, keeping the user strictly in Hosting mode.
 *
 * Note: If the notification is explicitly marked with role: "guest", it safely maps
 * to the corresponding traveller view.
 */
export function resolveHostNotificationDestination(
  notification: NotificationLike,
): string {
  const metadata = notification.metadata || {};
  const role = String(metadata.role || metadata.recipientRole || "").toLowerCase();

  // If explicitly guest role, respect it as verified in test suite
  if (role === "guest" || role === "traveller") {
    const rawLink = typeof notification.link === "string" ? notification.link.trim() : "";
    const bookingId =
      cleanIdentifier(metadata.bookingId) ||
      cleanIdentifier(metadata.id) ||
      cleanIdentifier(notification.entityId) ||
      extractParamFromLink(rawLink, /\/bookings\/([^/?#]+)/);
    if (bookingId) {
      return `/bookings/${encodeURIComponent(bookingId)}`;
    }
    return "/profile/tab/upcoming";
  }

  const routeResult = resolveNotificationRoute(notification, { currentMode: "host" });
  if (routeResult.targetUrl && routeResult.targetUrl.startsWith("/host/")) {
    return routeResult.targetUrl;
  }

  return "/host/today";
}

/**
 * Mode-aware notification destination resolver.
 * - When in "host" mode, guarantees a safe, valid /host/* route.
 * - When in "guest" mode, preserves valid guest paths or resolves guest destinations.
 * - When in "admin" mode, preserves admin paths.
 */
export function resolveNotificationDestination(
  notification: NotificationLike,
  options?: { mode?: NotificationNavigationMode },
): string {
  const mode = options?.mode ?? "guest";

  if (mode === "host") {
    return resolveHostNotificationDestination(notification);
  }

  const routeResult = resolveNotificationRoute(notification, { currentMode: "guest" });
  return routeResult.targetUrl;
}
