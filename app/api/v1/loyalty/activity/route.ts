import { LoyaltyActivityType } from "@/generated/prisma/enums";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { listLoyaltyActivity } from "@/services/loyalty-activity.service";

export const dynamic = "force-dynamic";
export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const query = req.nextUrl.searchParams;
  const typeValue = query.get("type");
  const type = typeValue && Object.values(LoyaltyActivityType).includes(typeValue as LoyaltyActivityType) ? typeValue as LoyaltyActivityType : undefined;
  const skip = query.get("skip") ? Number(query.get("skip")) : undefined;
  const take = query.get("take") ? Number(query.get("take")) : undefined;
  return ok(await listLoyaltyActivity(actor.id, { type, skip, take }));
});
