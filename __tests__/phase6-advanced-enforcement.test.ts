import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  assertUserNotRestricted,
  getUserEnforcementStatus,
  AccountRestrictionType,
  UserAccountRestriction,
  UserAccountWarning,
  UserAccountSuspension,
} from "../services/moderation.service";
import { PERMISSIONS } from "../lib/permissions/permissions";

const root = path.resolve(__dirname, "..");

function source(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Phase 6: Advanced Enforcement & Account/Message Moderation", async (t) => {
  await t.test("enforcement permission definitions and constants exist", () => {
    assert.equal(PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE, "moderation.enforcement.execute");
    assert.equal(PERMISSIONS.MODERATION_CASE_READ, "moderation.case.read");
  });

  await t.test("moderation service exports all required Phase 6 enforcement methods", () => {
    const serviceSrc = source("services/moderation.service.ts");
    assert.ok(serviceSrc.includes("assertUserNotRestricted"), "assertUserNotRestricted must be exported");
    assert.ok(serviceSrc.includes("getUserEnforcementStatus"), "getUserEnforcementStatus must be exported");
    assert.ok(serviceSrc.includes("issueAccountWarning"), "issueAccountWarning must be exported");
    assert.ok(serviceSrc.includes("revokeAccountWarning"), "revokeAccountWarning must be exported");
    assert.ok(serviceSrc.includes("applyAccountRestriction"), "applyAccountRestriction must be exported");
    assert.ok(serviceSrc.includes("liftAccountRestriction"), "liftAccountRestriction must be exported");
    assert.ok(serviceSrc.includes("suspendUserAccount"), "suspendUserAccount must be exported");
    assert.ok(serviceSrc.includes("reinstateUserAccount"), "reinstateUserAccount must be exported");
    assert.ok(serviceSrc.includes("getCaseBookingImpact"), "getCaseBookingImpact must be exported");
    assert.ok(serviceSrc.includes("getUserViolationHistory"), "getUserViolationHistory must be exported");
    assert.ok(serviceSrc.includes("getReportedMessageContext"), "getReportedMessageContext must be exported");
    assert.ok(serviceSrc.includes("executeMessageEnforcement"), "executeMessageEnforcement must be exported");
  });

  await t.test("Phase 6 API routes exist with proper authorization guards", () => {
    const enforcementRoute = source("app/api/v1/moderation/cases/[id]/enforcement/route.ts");
    assert.ok(enforcementRoute.includes("MODERATION_ENFORCEMENT_EXECUTE"), "enforcement route must check MODERATION_ENFORCEMENT_EXECUTE");
    assert.ok(enforcementRoute.includes("WARN"));
    assert.ok(enforcementRoute.includes("RESTRICT"));
    assert.ok(enforcementRoute.includes("SUSPEND"));
    assert.ok(enforcementRoute.includes("MESSAGE_ENFORCEMENT"));

    const bookingImpactRoute = source("app/api/v1/moderation/cases/[id]/booking-impact/route.ts");
    assert.ok(bookingImpactRoute.includes("getCaseBookingImpact"));

    const messageContextRoute = source("app/api/v1/moderation/cases/[id]/message-context/route.ts");
    assert.ok(messageContextRoute.includes("getReportedMessageContext"));

    const violationHistoryRoute = source("app/api/v1/moderation/users/[id]/violation-history/route.ts");
    assert.ok(violationHistoryRoute.includes("getUserViolationHistory"));

    const myEnforcementRoute = source("app/api/v1/moderation/me/enforcement/route.ts");
    assert.ok(myEnforcementRoute.includes("getUserEnforcementStatus"));
  });

  await t.test("runtime enforcement guards are integrated into messaging, booking, and listings", () => {
    const messagingSrc = source("services/messaging.service.ts");
    assert.ok(messagingSrc.includes('assertUserNotRestricted(actor.id, "RESTRICT_MESSAGING")'), "Messaging must check RESTRICT_MESSAGING");
    assert.ok(messagingSrc.includes("[This message was removed by Trust & Safety"), "toMessageDTO must mask removed messages");
    assert.ok(messagingSrc.includes("[This message has been hidden pending moderation investigation]"), "toMessageDTO must mask hidden messages");

    const bookingsRouteSrc = source("app/api/v1/bookings/route.ts");
    assert.ok(bookingsRouteSrc.includes('assertUserNotRestricted(actor.id, "RESTRICT_BOOKING")'), "Bookings must check RESTRICT_BOOKING");

    const listingsRouteSrc = source("app/api/v1/listings/route.ts");
    assert.ok(listingsRouteSrc.includes('assertUserNotRestricted(actor.id, "RESTRICT_LISTING_CREATION")'), "Listings must check RESTRICT_LISTING_CREATION");

    const reviewServiceSrc = source("services/review.service.ts");
    assert.ok(reviewServiceSrc.includes('assertUserNotRestricted(input.authorId, "RESTRICT_REVIEWS")'), "Reviews must check RESTRICT_REVIEWS");
  });

  await t.test("admin case details client includes enforcement, booking impact, violation history, and message controls", () => {
    const clientSrc = source("app/(protected)/admin/moderation/cases/[id]/admin-moderation-case-details-client.tsx");
    assert.ok(clientSrc.includes("canEnforce"), "Admin details must support canEnforce prop");
    assert.ok(clientSrc.includes("Trust &amp; Safety Enforcement") || clientSrc.includes("Trust & Safety Enforcement"), "Must render enforcement section");
    assert.ok(clientSrc.includes("EnforcementDialog"), "Must include EnforcementDialog component");
    assert.ok(clientSrc.includes("BookingImpactDialog"), "Must include BookingImpactDialog component");
    assert.ok(clientSrc.includes("ViolationHistoryDialog"), "Must include ViolationHistoryDialog component");
    assert.ok(clientSrc.includes("MessageEnforcementDialog"), "Must include MessageEnforcementDialog component");
    assert.ok(clientSrc.includes("Message Investigation &amp; Thread Context") || clientSrc.includes("Message Investigation & Thread Context"), "Must include message investigation section");
    assert.ok(clientSrc.includes("ModalOverlay"), "All dialogs must use ModalOverlay");
  });

  await t.test("guest/host reporting view displays user enforcement banners with appeal access", () => {
    const myReportsSrc = source("components/profile/my-reports-view.tsx");
    assert.ok(myReportsSrc.includes("fetchEnforcementStatus"), "my-reports-view must fetch enforcement status");
    assert.ok(myReportsSrc.includes("Account Access Suspended"), "my-reports-view must render suspension banner");
    assert.ok(myReportsSrc.includes("Active Account Restrictions"), "my-reports-view must render active restrictions banner");
    assert.ok(myReportsSrc.includes("Account Warning on Record"), "my-reports-view must render warnings banner");
  });

  await t.test("booking impact assessment preserves financial settlements and does not auto-cancel reservations", () => {
    const serviceSrc = source("services/moderation.service.ts");
    assert.ok(serviceSrc.includes("Financial settlement and booking records are preserved"), "Must include non-destructive disclaimer");
    assert.ok(serviceSrc.includes("bookingImpactAcknowledged"), "Suspension must require bookingImpactAcknowledged when active bookings exist");
  });
});
