import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { formatBookingDate } from "../lib/booking/booking-date";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Host Messages conversation details sidebar", () => {
  it("uses selectedConversation as single source of truth without stale cross-talk", () => {
    const workspace = read("components/host/messages/host-messages-workspace.tsx");

    // Confirms selectedConversation is derived directly from selectedId
    assert.match(workspace, /selectedConversation = conversations\.find\(\(c\) => c\.id === selectedId\) \|\| null/);
    // Confirms reservation details modal closes on conversation switch
    assert.match(workspace, /setShowReservationDetails\(false\)/);
  });

  it("dynamically computes context-aware header based on conversation and booking status", () => {
    const workspace = read("components/host/messages/host-messages-workspace.tsx");

    // Confirms dynamic categories and titles
    assert.match(workspace, /badge:\s*"Confirmed reservation"/);
    assert.match(workspace, /title:\s*`\$\{guestName\} is staying at your place`/);
    assert.match(workspace, /badge:\s*"Booking request"/);
    assert.match(workspace, /title:\s*`\$\{guestName\} requested to book your place`/);
    assert.match(workspace, /badge:\s*"Cancelled reservation"/);
    assert.match(workspace, /title:\s*`\$\{guestName\}'s reservation was cancelled`/);
    assert.match(workspace, /badge:\s*"Inquiry"/);
    assert.match(workspace, /title:\s*`\$\{guestName\} asked about your listing`/);
    assert.match(workspace, /badge:\s*"Special offer"/);
  });

  it("strictly separates guest identity, property title, and location", () => {
    const workspace = read("components/host/messages/host-messages-workspace.tsx");

    assert.match(workspace, /selectedConversation\.guest\.name/);
    assert.match(workspace, /selectedConversation\.listing\.title/);
    assert.match(workspace, /listingLocation/);
    assert.match(workspace, /\[district, city, country\]\.filter\(Boolean\)\.join\(", "\)/);
  });

  it("renders verified guest badges only when authentic and hides unavailable claims", () => {
    const workspace = read("components/host/messages/host-messages-workspace.tsx");

    // Only rendered if true
    assert.match(workspace, /selectedConversation\.guest\.identityVerified &&/);
    assert.match(workspace, /selectedConversation\.guest\.emailVerified &&/);
    // Profile link
    assert.match(workspace, /\/users\/profile\/\$\{selectedConversation\.guest\.id\}/);
    // Does not claim fake rating
    assert.doesNotMatch(workspace, />5\.0 rating</);
  });

  it("conditionally isolates Inquiry Details vs Booking Details", () => {
    const workspace = read("components/host/messages/host-messages-workspace.tsx");

    // Conditional branches
    assert.match(workspace, /selectedConversation\.booking \?/);
    assert.match(workspace, /<h4 className="text-xl font-medium text-\[#1F1F1F\]">Booking details<\/h4>/);
    assert.match(workspace, /<h4 className="text-xl font-medium text-\[#1F1F1F\]">Inquiry details<\/h4>/);
    assert.match(workspace, /This is a pre-booking inquiry\. The guest has not yet confirmed a reservation\./);
  });

  it("maps real booking statuses to UI badges and connects ReservationDetails modal", () => {
    const workspace = read("components/host/messages/host-messages-workspace.tsx");

    assert.match(workspace, /Confirmed stay/);
    assert.match(workspace, /Pending/);
    assert.match(workspace, /Cancelled/);
    assert.match(workspace, /Declined/);
    assert.match(workspace, /Expired/);
    assert.match(workspace, /View Reservation Details/);
    assert.match(workspace, /<ReservationDetails/);
    assert.match(workspace, /booking=\{selectedReservation\}/);
    assert.match(workspace, /listing=\{selectedListingDTO\}/);
  });

  it("formats stay dates with canonical UTC utilities avoiding hydration bugs", () => {
    const workspace = read("components/host/messages/host-messages-workspace.tsx");

    assert.doesNotMatch(workspace, /toLocale(?:Date|Time)String/);
    assert.match(workspace, /formatBookingDate\(b\.startDate, \{ weekday: true \}\)/);
    assert.match(workspace, /formatBookingDate\(b\.endDate, \{ weekday: true \}\)/);

    // Test date helper stability
    assert.equal(
      formatBookingDate("2026-10-04", { weekday: true }),
      "Sun, Oct 4, 2026",
    );
    assert.equal(
      formatBookingDate("2026-10-06", { weekday: true }),
      "Tue, Oct 6, 2026",
    );
  });
});

