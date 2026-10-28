import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("booking creation writes one non-user booking event into its linked conversation", () => {
  const booking = read("services/booking.service.ts");
  const messaging = read("services/messaging.service.ts");

  assert.match(booking, /startDate: createdBooking\.startDate/);
  assert.match(booking, /endDate: createdBooking\.endDate/);
  assert.match(messaging, /BOOKING_REQUEST_SUBMITTED/);
  assert.match(messaging, /BOOKING_CONFIRMED_ON_CREATE/);
  assert.match(messaging, /senderId: null/);
  assert.match(messaging, /type: MessageType\.BOOKING_STATUS/);
  assert.match(messaging, /systemGenerated: true/);
  assert.match(messaging, /metadata: \{ path: \["bookingEvent"\], equals: bookingEvent \}/);
});

test("booking status retries do not duplicate a system event", () => {
  const messaging = read("services/messaging.service.ts");

  assert.match(messaging, /existingStatusEvent/);
  assert.match(messaging, /BOOKING_STATUS_CHANGED/);
  assert.match(messaging, /if \(!existingStatusEvent\)/);
});

test("host booking notifications open the exact reservation", () => {
  const booking = read("services/booking.service.ts");
  const requestToBook = read("services/request-to-book.service.ts");

  assert.match(booking, /link: `\/host\/bookings\/\$\{booking\.id\}`/);
  assert.match(booking, /link: `\/host\/bookings\/\$\{cancelled\.id\}`/);
  assert.match(requestToBook, /link: `\/host\/bookings\/\$\{input\.bookingId\}`/);
});

test("older empty reservation threads render reservation context instead of an unexplained empty state", () => {
  const hostWorkspace = read("components/host/messages/host-messages-workspace.tsx");
  const guestWorkspace = read("components/messages/guest-messages-workspace.tsx");

  for (const workspace of [hostWorkspace, guestWorkspace]) {
    assert.match(workspace, /selectedConversation\.booking/);
    assert.match(workspace, /formatBookingDateRange\(selectedConversation\.booking\.startDate, selectedConversation\.booking\.endDate\)/);
    assert.match(workspace, /Reservation reference: \{selectedConversation\.booking\.id\}/);
  }

  assert.match(hostWorkspace, /conv\.listing\.title/);
  assert.match(hostWorkspace, /getMessagePreview\(conv\.lastMessage, t, conv\.booking\?\.status\)/);
  assert.match(guestWorkspace, /getMessagePreview\(conv\.lastMessage, t, conv\.booking\?\.status\)/);
});
