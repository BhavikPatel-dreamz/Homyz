import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getHostReviewEligibility } from "@/lib/booking/host-review-eligibility";
import { buildOperationalEvents } from "@/lib/booking/host-reservation-events";
import type { HostReservation } from "@/components/host/host-workspace-shared";
import type { ListingDTO } from "@/services/mappers";

const completeStay = {
  isAuthorizedHost: true,
  bookingStatus: "CONFIRMED",
  endDate: "2026-10-03",
  checkOutTime: "11:00",
  hasHostReview: false,
};

describe("Host completed reservation review eligibility", () => {
  it("marks a completed, unreviewed stay inside the review window as pending", () => {
    const eligibility = getHostReviewEligibility({
      ...completeStay,
      now: new Date("2026-10-04T12:00:00.000Z"),
    });
    assert.equal(eligibility.status, "REVIEW_PENDING");
    assert.equal(eligibility.eligible, true);
    assert.equal(eligibility.reviewSubmitted, false);
  });

  it("rejects an already submitted host review", () => {
    const eligibility = getHostReviewEligibility({
      ...completeStay,
      hasHostReview: true,
      now: new Date("2026-10-04T12:00:00.000Z"),
    });
    assert.equal(eligibility.status, "REVIEW_SUBMITTED");
    assert.equal(eligibility.eligible, false);
  });

  it("rejects a review after the configured review window", () => {
    const eligibility = getHostReviewEligibility({
      ...completeStay,
      now: new Date("2026-11-03T12:00:00.000Z"),
    });
    assert.equal(eligibility.status, "REVIEW_WINDOW_EXPIRED");
    assert.equal(eligibility.eligible, false);
  });

  it("rejects incomplete stays and bookings outside the host's scope", () => {
    assert.equal(
      getHostReviewEligibility({
        ...completeStay,
        now: new Date("2026-10-03T10:59:00.000Z"),
      }).status,
      "NOT_ELIGIBLE",
    );
    assert.equal(
      getHostReviewEligibility({
        ...completeStay,
        isAuthorizedHost: false,
        now: new Date("2026-10-04T12:00:00.000Z"),
      }).status,
      "NOT_ELIGIBLE",
    );
    assert.equal(
      getHostReviewEligibility({
        ...completeStay,
        bookingStatus: "CANCELLED",
        now: new Date("2026-10-04T12:00:00.000Z"),
      }).status,
      "NOT_ELIGIBLE",
    );
  });

  it("places a confirmed booking in Completed only after its checkout time", () => {
    const booking: HostReservation = {
      id: "completed-stay",
      listingId: "listing-1",
      status: "CONFIRMED",
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      createdAt: "2026-09-01T00:00:00.000Z",
      guestName: "Guest",
      guestImage: null,
      guests: 1,
    };
    const listing = {
      id: "listing-1",
      title: "Listing",
      city: "Riyadh",
      district: "Al Olaya",
      country: "Saudi Arabia",
      photos: [],
      checkInStart: "15:00",
      checkOutTime: "11:00",
    } as unknown as ListingDTO;
    const listings = new Map([[listing.id, listing]]);

    assert.equal(
      buildOperationalEvents([booking], listings, "completed", "2026-10-03", 10 * 60).length,
      0,
    );
    assert.equal(
      buildOperationalEvents([booking], listings, "completed", "2026-10-03", 11 * 60).length,
      1,
    );
  });
});
