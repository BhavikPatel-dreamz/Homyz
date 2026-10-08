import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { listingService } from "@/services/listing.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Current, privacy-safe cards for a bounded set of public listing IDs.
 * Browser history stores only a display snapshot; this endpoint refreshes its
 * badge flags in one batched query rather than making one request per card.
 */
export const GET = apiHandler(async (req) => {
  const ids = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 12);

  return ok({ items: await listingService.getPublicCardsByIds(ids) });
});
