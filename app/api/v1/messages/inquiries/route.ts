import { apiHandler } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { messagingService } from "@/services/messaging.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);

  const body = await req.json();

  const result = await messagingService.createInquiryConversation(actor, {
    listingId: body.listingId,
    message: body.message,
    startDate: body.startDate,
    endDate: body.endDate,
    guests: body.guests ? Number(body.guests) : undefined,
  });

  return created(result);
});

