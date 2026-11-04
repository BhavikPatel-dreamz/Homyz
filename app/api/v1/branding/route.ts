import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getPublicBranding } from "@/lib/branding/branding";

/** Public, safe branding data only. All writes remain under the admin CMS API. */
export const GET = apiHandler(async () => ok(await getPublicBranding()));
