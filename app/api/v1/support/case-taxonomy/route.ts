import { NextRequest } from "next/server";

import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { GUEST_SUPPORT_TAXONOMY } from "@/lib/support-case/taxonomy";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  await requireApiAuth(req);
  return ok({ categories: GUEST_SUPPORT_TAXONOMY });
});
