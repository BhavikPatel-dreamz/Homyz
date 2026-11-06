import { test, describe } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  resolveHostNotificationDestination,
  resolveNotificationDestination,
  resolveNotificationRoute,
} from "@/lib/notifications/host-destination";
import { NotificationType } from "@/generated/prisma/enums";

describe("Host Notification Routing, Mode Preservation & Route Mapping", () => {
  const hostDestinationPath = path.join(
    process.cwd(),
    "lib/notifications/host-destination.ts"
  );
  const drawerNotifPath = path.join(
    process.cwd(),
    "components/host/navigation/host-drawer-notifications.tsx"
  );
  const profileNotifPath = path.join(
    process.cwd(),
    "components/profile/notifications-view.tsx"
  );
  const notifServicePath = path.join(
    process.cwd(),
    "services/notification.service.ts"
  );

  test("Phase 1: Required files exist", () => {
    assert.ok(fs.existsSync(hostDestinationPath), "host-destination.ts must exist");
    assert.ok(fs.existsSync(drawerNotifPath), "host-drawer-notifications.tsx must exist");
    assert.ok(fs.existsSync(profileNotifPath), "notifications-view.tsx must exist");
    assert.ok(fs.existsSync(notifServicePath), "notification.service.ts must exist");
  });

  test("Phase 2: Booking notifications map strictly to Host booking routes", () => {
    // 1. Booking request with bookingId in metadata
    const dest1 = resolveHostNotificationDestination({
      type: NotificationType.BOOKING,
      title: "Booking Request: Beach Villa",
      metadata: { bookingId: "bk_12345", status: "PENDING", role: "host" },
    });
    assert.strictEqual(dest1, "/host/bookings/bk_12345");

    // 2. Booking confirmed with entityId
    const dest2 = resolveHostNotificationDestination({
      type: NotificationType.BOOKING,
      entityId: "bk_67890",
      entityType: "host_booking",
      metadata: { status: "CONFIRMED", role: "host" },
    });
    assert.strictEqual(dest2, "/host/bookings/bk_67890");

    // 3. Booking cancelled with ID
    const dest3 = resolveHostNotificationDestination({
      type: NotificationType.BOOKING,
      entityId: "bk_cancelled_99",
      entityType: "host_booking",
      metadata: { status: "CANCELLED" },
    });
    assert.strictEqual(dest3, "/host/bookings/bk_cancelled_99");

    // 4. Booking notification without booking ID falls back to host tabs
    const destPending = resolveHostNotificationDestination({
      type: NotificationType.BOOKING,
      metadata: { status: "PENDING" },
    });
    assert.strictEqual(destPending, "/host/today?tab=pending");

    const destCancelled = resolveHostNotificationDestination({
      type: NotificationType.BOOKING,
      metadata: { status: "CANCELLED" },
    });
    assert.strictEqual(destCancelled, "/host/today?tab=cancelled");

    const destDefault = resolveHostNotificationDestination({
      type: NotificationType.BOOKING,
    });
    assert.strictEqual(destDefault, "/host/today?tab=upcoming");

    // 5. Booking notification with role: "guest" safely maps to guest reservation view
    const destGuest = resolveHostNotificationDestination({
      type: NotificationType.BOOKING,
      metadata: { bookingId: "bk_guest_999", role: "guest" },
    });
    assert.strictEqual(destGuest, "/bookings/bk_guest_999");
  });

  test("Phase 2: Messaging notifications map strictly to Host messages", () => {
    // 1. Message with conversationId in metadata
    const dest1 = resolveHostNotificationDestination({
      type: NotificationType.MESSAGE,
      metadata: { conversationId: "conv_abc123" },
    });
    assert.strictEqual(dest1, "/host/messages?id=conv_abc123");

    // 2. Message with entityId as conversation
    const dest2 = resolveHostNotificationDestination({
      type: NotificationType.MESSAGE,
      entityId: "conv_xyz789",
      entityType: "conversation",
    });
    assert.strictEqual(dest2, "/host/messages?id=conv_xyz789");

    // 3. Message without specific ID falls back to Host messages overview
    const dest3 = resolveHostNotificationDestination({
      type: NotificationType.MESSAGE,
    });
    assert.strictEqual(dest3, "/host/messages");
  });

  test("Phase 2: Listing & Regulation notifications map to Host listing screens", () => {
    // 1. Listing approval/update with listingId
    const dest1 = resolveHostNotificationDestination({
      type: NotificationType.SYSTEM,
      entityType: "listing",
      entityId: "lst_100",
    });
    assert.strictEqual(dest1, "/host/listings/lst_100");

    // 2. License / Regulation alert
    const dest2 = resolveHostNotificationDestination({
      type: NotificationType.SYSTEM,
      entityType: "listing_license",
      metadata: { listingId: "lst_200" },
      link: "/host/listings/lst_200/regulations",
    });
    assert.strictEqual(dest2, "/host/listings/lst_200/regulations");

    // 2b. License notification with raw link missing /regulations automatically resolves to /regulations
    const destSaudiLicense = resolveHostNotificationDestination({
      type: NotificationType.SYSTEM,
      title: "Saudi license verified",
      message: "Your Saudi property license was verified for this listing.",
      entityId: "cmw3cb41z003j8masqv59v6fr",
      entityType: "SAUDI_LICENSE_VERIFICATION:ACTIVE",
      link: "/host/listings/cmw3cb41z003j8masqv59v6fr",
    });
    assert.strictEqual(
      destSaudiLicense,
      "/host/listings/cmw3cb41z003j8masqv59v6fr/regulations",
      "Saudi license notifications must redirect to listing regulations page"
    );

    // 3. Listing fallback
    const dest3 = resolveHostNotificationDestination({
      type: NotificationType.SYSTEM,
      entityType: "listing",
    });
    assert.strictEqual(dest3, "/host/listings");
  });

  test("Phase 2: Financial, Earnings, and Payout notifications map to Host earnings", () => {
    // 1. Specific transaction
    const dest1 = resolveHostNotificationDestination({
      type: NotificationType.SYSTEM,
      entityType: "payout",
      metadata: { transactionId: "txn_555" },
    });
    assert.strictEqual(dest1, "/host/earnings/transactions/txn_555");

    // 2. Payout method update
    const dest2 = resolveHostNotificationDestination({
      type: NotificationType.SYSTEM,
      entityType: "payout-method",
    });
    assert.strictEqual(dest2, "/host/account-settings/payouts");

    // 3. Tax documents
    const dest3 = resolveHostNotificationDestination({
      type: NotificationType.SYSTEM,
      entityType: "tax_document",
    });
    assert.strictEqual(dest3, "/host/account-settings/taxes");

    // 4. General earnings fallback
    const dest4 = resolveHostNotificationDestination({
      type: NotificationType.SYSTEM,
      entityType: "earning",
    });
    assert.strictEqual(dest4, "/host/earnings");
  });

  test("Phase 2: Dispute and Support notifications map to Host Resolution/Support Center", () => {
    // 1. Dispute case
    const dest1 = resolveHostNotificationDestination({
      type: NotificationType.BOOKING,
      entityType: "dispute-case-created",
      metadata: { disputeId: "disp_999" },
    });
    assert.strictEqual(dest1, "/host/resolution-center/disp_999");

    // 2. Direct resolution offer
    const dest2 = resolveHostNotificationDestination({
      type: NotificationType.SYSTEM,
      entityType: "RESOLUTION_OFFER",
      metadata: { caseId: "case_444" },
    });
    assert.strictEqual(dest2, "/host/resolution-center/direct?caseId=case_444");

    // 3. Support case
    const dest3 = resolveHostNotificationDestination({
      type: NotificationType.SYSTEM,
      entityType: "SUPPORT_CASE",
      metadata: { caseId: "case_888" },
    });
    assert.strictEqual(dest3, "/host/support?caseId=case_888");
  });

  test("Phase 2: Profile, Settings, Calendar, Refer, and Co-host notifications", () => {
    // 1. Profile / Account Settings
    const destProfile = resolveHostNotificationDestination({
      type: NotificationType.SYSTEM,
      entityType: "profile_completion",
    });
    assert.strictEqual(destProfile, "/host/account-settings");

    // 2. Refer a host
    const destRefer = resolveHostNotificationDestination({
      type: NotificationType.PROMOTION,
      entityType: "referral_program",
    });
    assert.strictEqual(destRefer, "/host/refer");

    // 3. Co-host
    const destCoHost = resolveHostNotificationDestination({
      type: NotificationType.SYSTEM,
      entityType: "co-host",
    });
    assert.strictEqual(destCoHost, "/host/co-host");

    // 4. Calendar availability alert
    const destCalendar = resolveHostNotificationDestination({
      type: NotificationType.SYSTEM,
      entityType: "pricing_availability_alert",
      metadata: { listingId: "lst_cal_1" },
    });
    assert.strictEqual(destCalendar, "/host/calendar?listingId=lst_cal_1");
  });

  test("Phase 3 & Phase 7: Historical/Legacy notifications with Guest URLs are safely remapped to Host routes", () => {
    // 1. Legacy guest booking URL -> remapped to /host/bookings/[id]
    const legacyBooking = resolveHostNotificationDestination({
      type: NotificationType.BOOKING,
      link: "/bookings/legacy_bk_777",
    });
    assert.strictEqual(legacyBooking, "/host/bookings/legacy_bk_777");

    // 2. Legacy trips upcoming URL -> remapped to /host/today?tab=upcoming
    const legacyTripsUpcoming = resolveHostNotificationDestination({
      type: NotificationType.BOOKING,
      link: "/profile/tab/upcoming",
    });
    assert.strictEqual(legacyTripsUpcoming, "/host/today?tab=upcoming");

    // 3. Legacy trips past URL -> remapped to /host/today?tab=cancelled
    const legacyTripsPast = resolveHostNotificationDestination({
      type: NotificationType.BOOKING,
      link: "/profile/tab/past",
    });
    assert.strictEqual(legacyTripsPast, "/host/today?tab=cancelled");

    // 4. Legacy guest message URL -> remapped to /host/messages?id=...
    const legacyMsg = resolveHostNotificationDestination({
      type: NotificationType.MESSAGE,
      link: "/messages?id=conv_legacy_1",
    });
    assert.strictEqual(legacyMsg, "/host/messages?id=conv_legacy_1");

    // 5. Legacy guest listing URL -> remapped to /host/listings/...
    const legacyListing = resolveHostNotificationDestination({
      type: NotificationType.SYSTEM,
      link: "/listings/lst_legacy_2",
    });
    assert.strictEqual(legacyListing, "/host/listings/lst_legacy_2");

    // 6. Legacy guest profile URL -> remapped to /host/account-settings
    const legacyProfile = resolveHostNotificationDestination({
      type: NotificationType.SYSTEM,
      link: "/profile/tab/profile_management/profile_information",
    });
    assert.strictEqual(legacyProfile, "/host/account-settings");

    // 7. Legacy guest invite URL -> remapped to /host/refer
    const legacyInvite = resolveHostNotificationDestination({
      type: NotificationType.PROMOTION,
      link: "/profile/tab/invite",
    });
    assert.strictEqual(legacyInvite, "/host/refer");

    // 8. Legacy travel profile URL -> remapped to /host/account-settings
    const legacyTravelProfile = resolveHostNotificationDestination({
      type: NotificationType.SYSTEM,
      link: "/travel-profile",
    });
    assert.strictEqual(legacyTravelProfile, "/host/account-settings");
  });

  test("Phase 3 & Phase 9: Open redirects, external URLs, and malicious links are strictly rejected", () => {
    const maliciousCases = [
      "https://malicious-site.com/steal-data",
      "http://attacker.org/phishing",
      "//untrusted-domain.com",
      "javascript:alert(document.cookie)",
      "data:text/html,<script>alert(1)</script>",
      "/host/../../etc/passwd",
      "/host/unknown-invalid-route",
    ];

    for (const badLink of maliciousCases) {
      const destination = resolveHostNotificationDestination({
        type: NotificationType.SYSTEM,
        link: badLink,
      });
      assert.ok(
        destination.startsWith("/host/"),
        `Destination must remain a valid Host route for: ${badLink}, got ${destination}`
      );
      assert.ok(
        !destination.includes("malicious") && !destination.includes("attacker") && !destination.includes("javascript"),
        `Must sanitize malicious target: ${badLink}`
      );
    }
  });

  test("Phase 3: Every Host notification destination strictly preserves Hosting Mode (starts with /host/)", () => {
    const sampleNotifications = [
      { type: NotificationType.BOOKING, metadata: { bookingId: "b1" } },
      { type: NotificationType.MESSAGE, metadata: { conversationId: "c1" } },
      { type: NotificationType.PROMOTION },
      { type: NotificationType.SYSTEM, entityType: "license" },
      { type: NotificationType.SYSTEM, entityType: "superhost_evaluation" },
      { type: NotificationType.SYSTEM, entityType: "guest_favorite_evaluation" },
      { type: NotificationType.SYSTEM, entityType: "profile_completion" },
      { type: NotificationType.SYSTEM, entityType: "co-host" },
      { type: NotificationType.BOOKING, entityType: "dispute-case-created", metadata: { disputeId: "d1" } },
      { type: NotificationType.SYSTEM, entityType: "SUPPORT_CASE", metadata: { caseId: "s1" } },
      { type: "UNKNOWN_TYPE" as any },
      {},
    ];

    for (const notif of sampleNotifications) {
      const destination = resolveHostNotificationDestination(notif);
      assert.ok(
        destination.startsWith("/host/"),
        `Destination must start with /host/ to preserve Hosting mode, got: ${destination}`
      );
      assert.ok(
        !destination.startsWith("/profile") && !destination.startsWith("/bookings") && !destination.startsWith("/messages"),
        `Destination must never be a Guest route when resolved for Host: ${destination}`
      );
    }
  });

  test("Phase 4 & Phase 8: HostDrawerNotifications integrates the centralized resolver", () => {
    const drawerNotifContent = fs.readFileSync(drawerNotifPath, "utf8");
    assert.ok(
      drawerNotifContent.includes("resolveHostNotificationDestination"),
      "HostDrawerNotifications must import and call resolveHostNotificationDestination"
    );
    assert.ok(
      drawerNotifContent.includes("const destination = resolveHostNotificationDestination(item)"),
      "handleNotificationClick must resolve destination via resolveHostNotificationDestination"
    );
  });

  test("Phase 4: NotificationsView integration respects host notification routing", () => {
    const profileNotifContent = fs.readFileSync(profileNotifPath, "utf8");
    assert.ok(
      profileNotifContent.includes("resolveHostNotificationDestination"),
      "NotificationsView must import resolveHostNotificationDestination"
    );
    assert.ok(
      profileNotifContent.includes("isHostNotification"),
      "NotificationsView must detect host notifications and map them cleanly"
    );
  });

  test("Phase 6: notification.service.ts uses host routing in toDTO and syncRealEventsForUser", () => {
    const serviceContent = fs.readFileSync(notifServicePath, "utf8");
    assert.ok(
      serviceContent.includes("resolveHostNotificationDestination"),
      "notification.service.ts must import and use resolveHostNotificationDestination"
    );
    assert.ok(
      serviceContent.includes("link = resolveHostNotificationDestination"),
      "toDTO must sanitize host-scoped notification links"
    );
    assert.ok(
      serviceContent.includes("/host/bookings/"),
      "syncRealEventsForUser must link host bookings to /host/bookings/[id]"
    );
  });

  test("Phase 13: Mode-aware resolution preserves guest routes when in guest mode", () => {
    const guestDest = resolveNotificationDestination(
      {
        type: NotificationType.BOOKING,
        entityId: "bk_guest_1",
        entityType: "booking",
        link: "/profile/tab/upcoming",
      },
      { mode: "guest" }
    );
    assert.strictEqual(guestDest, "/profile/tab/upcoming");

    const hostDest = resolveNotificationDestination(
      {
        type: NotificationType.BOOKING,
        entityId: "bk_host_1",
        entityType: "host_booking",
        link: "/profile/tab/upcoming", // Legacy stored link
      },
      { mode: "host" }
    );
    assert.strictEqual(hostDest, "/host/bookings/bk_host_1");
  });

  test("Phase 14: Host booking detail page handles guest permissions gracefully without 403 crash", () => {
    const bookingPagePath = path.join(
      process.cwd(),
      "app/(protected)/host/bookings/[id]/page.tsx"
    );
    const bookingPageContent = fs.readFileSync(bookingPagePath, "utf8");

    assert.ok(
      bookingPageContent.includes("redirect(`/bookings/${id}`)"),
      "HostBookingDetailPage must redirect guests to /bookings/[id] if they access their own guest reservation"
    );
    assert.ok(
      bookingPageContent.includes("notFound()"),
      "HostBookingDetailPage must render notFound() rather than throwing unhandled 403 for unauthorized users"
    );

    const bookingServiceContent = fs.readFileSync(
      path.join(process.cwd(), "services/booking.service.ts"),
      "utf8"
    );
    assert.ok(
      bookingServiceContent.includes("isAcceptedCoHost"),
      "booking.service.ts must allow accepted co-hosts to access getRequestDetailsForHost"
    );
  });

  test("Phase 15: Symmetrical Guard on Traveller booking details page redirects host to host side", () => {
    const guestBookingPagePath = path.join(
      process.cwd(),
      "app/(protected)/bookings/[id]/page.tsx"
    );
    const guestBookingPageContent = fs.readFileSync(guestBookingPagePath, "utf8");

    assert.ok(
      guestBookingPageContent.includes("redirect(`/host/bookings/${id}`)"),
      "BookingDetailsPage must redirect hosts and co-hosts to /host/bookings/[id]"
    );
    assert.ok(
      guestBookingPageContent.includes("details.listing?.host?.id === user.id"),
      "BookingDetailsPage must check if current user is the listing host"
    );
    assert.ok(
      guestBookingPageContent.includes("ListingCoHostStatus.ACCEPTED"),
      "BookingDetailsPage must check accepted co-host status"
    );
  });

  test("Phase 16: Master Resolver satisfies complete contract & dual-role routing matrix", () => {
    // 1. Traveller books host listing -> Host notification opens /host/bookings/[id]
    const res1 = resolveNotificationRoute({
      type: NotificationType.BOOKING,
      title: "New Booking Request: Sea View Villa",
      message: "A guest requested to book Sea View Villa from 2026-12-01 to 2026-12-05.",
      entityId: "bk_new_host_1",
      entityType: "host_booking",
      link: "/host/bookings/bk_new_host_1",
      metadata: { bookingId: "bk_new_host_1", role: "host" },
    });
    assert.strictEqual(res1.context, "HOST");
    assert.strictEqual(res1.targetUrl, "/host/bookings/bk_new_host_1");

    // 2. Traveller receives booking confirmation -> Opens /bookings/[id]
    const res2 = resolveNotificationRoute({
      type: NotificationType.BOOKING,
      title: "Reservation Confirmed: Sea View Villa",
      message: "Your stay at Sea View Villa from 2026-12-01 to 2026-12-05 is confirmed.",
      entityId: "bk_guest_conf_2",
      entityType: "booking",
      link: "/bookings/bk_guest_conf_2",
      metadata: { bookingId: "bk_guest_conf_2", role: "guest" },
    });
    assert.strictEqual(res2.context, "TRAVELLER");
    assert.strictEqual(res2.targetUrl, "/bookings/bk_guest_conf_2");

    // 2b. Traveller booking confirmation with bookingId but no link -> defaults to /bookings/[id]
    const res2b = resolveNotificationRoute({
      type: NotificationType.BOOKING,
      metadata: { bookingId: "bk_guest_conf_2b", role: "guest" },
    });
    assert.strictEqual(res2b.context, "TRAVELLER");
    assert.strictEqual(res2b.targetUrl, "/bookings/bk_guest_conf_2b");

    // 3. Host receives cancellation -> Opens /host/bookings/[id]
    const res3 = resolveNotificationRoute({
      type: NotificationType.BOOKING,
      title: "Reservation Cancelled: Sea View Villa",
      message: "A guest cancelled their reservation for Sea View Villa.",
      entityId: "bk_cancelled_3",
      entityType: "host_booking",
      link: "/host/bookings/bk_cancelled_3",
      metadata: { bookingId: "bk_cancelled_3", role: "host", status: "CANCELLED" },
    });
    assert.strictEqual(res3.context, "HOST");
    assert.strictEqual(res3.targetUrl, "/host/bookings/bk_cancelled_3");

    // 4. Traveller cancels booking -> Opens /profile/tab/past or /bookings/[id]
    const res4 = resolveNotificationRoute({
      type: NotificationType.BOOKING,
      title: "Reservation Cancelled: Sea View Villa",
      message: "Your reservation for Sea View Villa has been cancelled.",
      entityId: "bk_cancelled_4",
      entityType: "booking",
      link: "/profile/tab/past",
      metadata: { bookingId: "bk_cancelled_4", role: "guest", status: "CANCELLED" },
    });
    assert.strictEqual(res4.context, "TRAVELLER");
    assert.strictEqual(res4.targetUrl, "/profile/tab/past");

    const res4b = resolveNotificationRoute({
      type: NotificationType.BOOKING,
      title: "Reservation Cancelled: Sea View Villa",
      message: "Your reservation for Sea View Villa has been cancelled.",
      entityId: "bk_cancelled_4b",
      entityType: "booking",
      link: "/bookings/bk_cancelled_4b",
      metadata: { bookingId: "bk_cancelled_4b", role: "guest", status: "CANCELLED" },
    });
    assert.strictEqual(res4b.context, "TRAVELLER");
    assert.strictEqual(res4b.targetUrl, "/bookings/bk_cancelled_4b");

    // 5. Host receives guest message -> Opens /host/messages?id=[id]
    const res5 = resolveNotificationRoute({
      type: NotificationType.MESSAGE,
      title: "Message from Guest Tariq",
      message: "Can we request early check-in at 1 PM?",
      entityId: "conv_host_msg_5",
      entityType: "host_conversation",
      link: "/host/messages?id=conv_host_msg_5",
      metadata: { conversationId: "conv_host_msg_5", role: "host" },
    });
    assert.strictEqual(res5.context, "HOST");
    assert.strictEqual(res5.targetUrl, "/host/messages?id=conv_host_msg_5");

    // 6. Traveller receives host message -> Opens /messages?id=[id]
    const res6 = resolveNotificationRoute({
      type: NotificationType.MESSAGE,
      title: "Message from Host Nora",
      message: "Yes, early check-in is approved!",
      entityId: "conv_guest_msg_6",
      entityType: "conversation",
      link: "/messages?id=conv_guest_msg_6",
      metadata: { conversationId: "conv_guest_msg_6", role: "guest" },
    });
    assert.strictEqual(res6.context, "TRAVELLER");
    assert.strictEqual(res6.targetUrl, "/messages?id=conv_guest_msg_6");

    // 7. Host receives payout notification -> Opens /host/earnings/transactions/[id]
    const res7 = resolveNotificationRoute({
      type: NotificationType.SYSTEM,
      title: "Payout processed",
      message: "Your payout of SAR 4,500.00 has been sent to your bank account.",
      entityType: "payout",
      metadata: { transactionId: "txn_payout_7" },
    });
    assert.strictEqual(res7.context, "HOST");
    assert.strictEqual(res7.targetUrl, "/host/earnings/transactions/txn_payout_7");

    // 8. Dual-role user receives Host notification while browsing Traveller pages (currentMode: guest)
    const res8 = resolveNotificationRoute(
      {
        type: NotificationType.BOOKING,
        title: "New Reservation: Desert Rose Chalet",
        message: "Faisal booked Desert Rose Chalet from 2026-11-20 to 2026-11-22.",
        entityId: "bk_dual_host_8",
        entityType: "host_booking",
        metadata: { bookingId: "bk_dual_host_8", role: "host" },
      },
      { currentMode: "guest" }
    );
    assert.strictEqual(res8.context, "HOST");
    assert.strictEqual(res8.targetUrl, "/host/bookings/bk_dual_host_8");

    // 9. Dual-role user receives Traveller notification while browsing Host pages (currentMode: host)
    const res9 = resolveNotificationRoute(
      {
        type: NotificationType.BOOKING,
        title: "Reservation Confirmed: Mountain Retreat",
        message: "Your stay at Mountain Retreat from 2026-12-10 to 2026-12-15 is confirmed.",
        entityId: "bk_dual_traveller_9",
        entityType: "booking",
        metadata: { bookingId: "bk_dual_traveller_9", role: "guest" },
      },
      { currentMode: "host" }
    );
    assert.strictEqual(res9.context, "TRAVELLER");
    assert.strictEqual(res9.targetUrl, "/bookings/bk_dual_traveller_9");

    // 10. Saudi license notification -> Resolves to /host/listings/[id]/regulations
    const res10 = resolveNotificationRoute({
      type: NotificationType.SYSTEM,
      title: "Saudi license verified",
      message: "Your Saudi property license was verified for this listing.",
      entityId: "lst_saudi_10",
      entityType: "SAUDI_LICENSE_VERIFICATION:ACTIVE",
      link: "/host/listings/lst_saudi_10",
    });
    assert.strictEqual(res10.context, "HOST");
    assert.strictEqual(res10.targetUrl, "/host/listings/lst_saudi_10/regulations");

    // 11. Legacy notification without metadata role: Host booking request
    const res11 = resolveNotificationRoute({
      type: NotificationType.BOOKING,
      title: "Booking Request: Sunset Penthouse",
      message: "Guest requested to book Sunset Penthouse from 2026-11-18 to 2026-11-20.",
      entityId: "bk_legacy_host_11",
      link: "/bookings/bk_legacy_host_11",
    });
    assert.strictEqual(res11.context, "HOST");
    assert.strictEqual(res11.targetUrl, "/host/bookings/bk_legacy_host_11");

    // 12. Legacy notification without metadata role: Traveller booking submitted
    const res12 = resolveNotificationRoute({
      type: NotificationType.BOOKING,
      title: "Booking Request Submitted: City Loft",
      message: "Your booking request for City Loft is being reviewed.",
      entityId: "bk_legacy_guest_12",
      link: "/bookings/bk_legacy_guest_12",
    });
    assert.strictEqual(res12.context, "TRAVELLER");
    assert.strictEqual(res12.targetUrl, "/bookings/bk_legacy_guest_12");
  });

  test("GEMINI.md: Strict adherence to typography rules (0 font-bold/font-semibold/<b>/<strong>)", () => {
    const guestBookingPagePath = path.join(
      process.cwd(),
      "app/(protected)/bookings/[id]/page.tsx"
    );
    const filesToCheck = [hostDestinationPath, drawerNotifPath, guestBookingPagePath];
    for (const file of filesToCheck) {
      const content = fs.readFileSync(file, "utf8");
      const boldMatches = content.match(/font-bold|font-semibold/g) || [];
      assert.strictEqual(
        boldMatches.length,
        0,
        `Found forbidden font weights in ${file}: ${boldMatches.join(", ")}`
      );
      const tagMatches = content.match(/<b\b|<strong\b/g) || [];
      assert.strictEqual(
        tagMatches.length,
        0,
        `Found forbidden <b> or <strong> tags in ${file}`
      );
    }
  });
});

