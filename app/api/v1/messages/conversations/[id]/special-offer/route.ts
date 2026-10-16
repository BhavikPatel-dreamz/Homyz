import { apiHandler } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { messagingService } from "@/services/messaging.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = apiHandler(async (req, { params }) => {
  const actor = await requireApiAuth(req);
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;

  const body = await req.json();

  const result = await messagingService.sendSpecialOffer(actor, id, {
    startDate: body.startDate,
    endDate: body.endDate,
    guests: Number(body.guests) || 1,
    subtotalPrice: Number(body.subtotalPrice),
    currency: body.currency,
    messageText: body.messageText,
    listingId: body.listingId,
  });

  return created(result);
});

