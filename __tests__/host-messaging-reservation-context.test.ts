import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { BookingStatus } from "@/generated/prisma/enums";
import type { ConversationBookingDTO } from "@/services/messaging.service";

// The classifier is pure, but its service module also owns the Prisma client.
// Give that module a syntactically valid URL so this unit test can run on a
// fresh checkout without a local database; it never performs a query.
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/homyz_test";

let messagingServicePromise: Promise<typeof import("@/services/messaging.service")> | undefined;

async function classifyReservationContext(...args: Parameters<typeof import("@/services/messaging.service").classifyReservationContext>) {
  const service = await (messagingServicePromise ??= import("@/services/messaging.service"));
  return service.classifyReservationContext(...args);
}

const root = path.resolve(import.meta.dirname, "..");

function booking(
  id: string,
  startDate: string,
  endDate: string,
  status = BookingStatus.CONFIRMED,
): ConversationBookingDTO {
  return {
    id,
    status,
    startDate,
    endDate,
    guests: 2,
    totalPrice: 20000,
    nightlyPrice: 10000,
    currency: "SAR",
    cancellationPolicy: "FLEXIBLE",
  };
}

describe("Host message reservation context", () => {
  it("prefers a current or upcoming confirmed booking over an older stay", async () => {
    const context = await classifyReservationContext(
      [
        booking("past", "2026-09-01", "2026-09-03"),
        booking("upcoming", "2026-10-25", "2026-10-28"),
        booking("current", "2026-10-18", "2026-10-22"),
      ],
      "2026-10-20",
    );

    assert.equal(context.kind, "ACTIVE_RESERVATION");
    assert.equal(context.booking?.id, "current");
  });

  it("labels the most recent completed confirmed booking as a past stay", async () => {
    const context = await classifyReservationContext(
      [
        booking("older", "2026-08-01", "2026-08-03"),
        booking("latest", "2026-09-10", "2026-09-14"),
      ],
      "2026-10-20",
    );

    assert.equal(context.kind, "PAST_STAY");
    assert.equal(context.booking?.id, "latest");
  });

  it("does not turn pending or cancelled requests into reservation context", async () => {
    const context = await classifyReservationContext(
      [
        booking("pending", "2026-10-24", "2026-10-26", BookingStatus.PENDING),
        booking("cancelled", "2026-10-24", "2026-10-26", BookingStatus.CANCELLED),
      ],
      "2026-10-20",
    );

    assert.deepEqual(context, { kind: "INQUIRY", booking: null });
  });

  it("uses batched context data and renders the derived tag in the host workspace", () => {
    const service = fs.readFileSync(path.join(root, "services/messaging.service.ts"), "utf8");
    const workspace = fs.readFileSync(
      path.join(root, "components/host/messages/host-messages-workspace.tsx"),
      "utf8",
    );

    assert.match(service, /contextBookingsByPair/);
    assert.match(service, /userId: conversation\.guestId/);
    assert.match(service, /listingId: conversation\.listingId/);
    assert.match(workspace, /getReservationContextBadge\(conv\.reservationContext\)/);
    assert.match(workspace, /getReservationContextBadge\(selectedConversation\.reservationContext\)/);
    assert.match(workspace, /p\.reservationContext\.kind !== n\.reservationContext\.kind/);
    assert.match(workspace, /p\.reservationContext\.booking\?\.status !== n\.reservationContext\.booking\?\.status/);
  });
});
