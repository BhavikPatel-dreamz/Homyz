export type DisputeNotificationRecipient = "ADMIN" | "GUEST" | "HOST";

/**
 * Canonical, role-scoped destinations for dispute notifications.  Keeping
 * this mapping in one place prevents a booking id from being used as a host
 * or admin case id, while preserving the existing guest booking detail view.
 */
export function resolveDisputeNotificationDestination(input: {
  disputeId: string;
  bookingId?: string | null;
  recipient: DisputeNotificationRecipient;
}): string | null {
  const disputeId = input.disputeId.trim();
  if (!disputeId) return null;

  if (input.recipient === "HOST") {
    return `/host/resolution-center/${encodeURIComponent(disputeId)}`;
  }
  if (input.recipient === "ADMIN") {
    return `/admin/bookings/disputes/${encodeURIComponent(disputeId)}`;
  }

  const bookingId = input.bookingId?.trim();
  return bookingId ? `/bookings/${encodeURIComponent(bookingId)}` : null;
}
