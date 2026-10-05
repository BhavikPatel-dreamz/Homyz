import { apiHandler } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { requestToBookSchema } from "@/lib/validation/booking";
import { requestToBookService } from "@/services/request-to-book.service";

// POST /api/v1/bookings/request — validates the complete request and remains
// fail-closed at the payment authorization boundary.
export const POST = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const input = requestToBookSchema.parse(await req.json());
  const booking = await requestToBookService.createRequestToBook(actor, input);
  return created(booking);
});
