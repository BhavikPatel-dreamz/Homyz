import { NextRequest } from "next/server";

import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { GUEST_SUPPORT_TAXONOMY, HOST_SUPPORT_TAXONOMY } from "@/lib/support-case/taxonomy";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiAuth(req);
  const audience = req.nextUrl.searchParams.get("audience");

  if (audience === "host" || (actor.role === "HOST" && audience !== "guest")) {
    return ok({
      categories: HOST_SUPPORT_TAXONOMY,
      hostCategories: HOST_SUPPORT_TAXONOMY,
      guestCategories: GUEST_SUPPORT_TAXONOMY,
    });
  }

  return ok({
    categories: GUEST_SUPPORT_TAXONOMY,
    guestCategories: GUEST_SUPPORT_TAXONOMY,
    hostCategories: HOST_SUPPORT_TAXONOMY,
  });
});
