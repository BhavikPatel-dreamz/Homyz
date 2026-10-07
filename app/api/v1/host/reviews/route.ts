import { apiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import { getSessionUser } from "@/lib/auth/session";
import {
  getHostGuestReview,
  getHostGuestReviewsForGuest,
  submitHostReview,
} from "@/services/host-review.service";

// POST /api/v1/host/reviews
// Submits a host review for a completed reservation.
export const POST = apiHandler(async (req) => {
  const actor = await getSessionUser();
  if (!actor) throw AppError.unauthorized();

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    throw AppError.badRequest("Invalid request body");
  }

  const result = await submitHostReview(actor, body);
  return ok(result);
});

// GET /api/v1/host/reviews?bookingId=... or ?guestId=...
// Retrieves host-to-guest review(s) respecting the visibility matrix.
export const GET = apiHandler(async (req) => {
  const actor = await getSessionUser();
  if (!actor) throw AppError.unauthorized();

  const bookingId = req.nextUrl.searchParams.get("bookingId")?.trim();
  const guestId = req.nextUrl.searchParams.get("guestId")?.trim();

  if (bookingId) {
    const review = await getHostGuestReview(actor, bookingId);
    return ok({ review });
  }

  if (guestId) {
    const result = await getHostGuestReviewsForGuest(actor, guestId);
    return ok(result);
  }

  throw AppError.badRequest("bookingId or guestId parameter is required");
});
