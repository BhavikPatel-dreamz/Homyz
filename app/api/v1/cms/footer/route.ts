import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { cmsFooterService } from "@/services/cms-footer.service";

// GET /api/v1/cms/footer?locale=en — Public cached endpoint for footer configuration
export const GET = apiHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const locale = searchParams.get("locale") || "en";

  const footer = await cmsFooterService.getPublishedFooter(locale);

  const response = ok(footer);
  response.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  return response;
});
