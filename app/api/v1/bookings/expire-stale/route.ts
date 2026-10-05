import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { bookingService } from "@/services/booking.service";

/**
 * POST /api/v1/bookings/expire-stale
 * Reconciles stale pending booking requests that have exceeded their 24-hour response deadline.
 * Idempotent, transaction-safe, and cache-invalidating.
 */
export const POST = apiHandler(async () => {
  const result = await bookingService.expireStaleBookingRequests();
  return ok(result);
});

