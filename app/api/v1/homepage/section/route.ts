import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { homepageService } from "@/services/homepage.service";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Reusable discovery endpoint accepting sectionId query parameter.
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const searchParams = req.nextUrl.searchParams;
  const sectionId = searchParams.get("sectionId") || searchParams.get("id");
  if (!sectionId) {
    throw AppError.badRequest("sectionId query parameter is required");
  }

  const page = parseInt(searchParams.get("page") || "1", 10) || 1;
  const limit = parseInt(searchParams.get("limit") || "8", 10) || 8;
  const city = searchParams.get("city") || undefined;
  const destination = searchParams.get("destination") || undefined;
  const checkIn = searchParams.get("checkIn") || undefined;
  const checkOut = searchParams.get("checkOut") || undefined;
  const guests = parseInt(searchParams.get("guests") || "1", 10) || 1;

  const user = await getSessionUser();

  const data = await homepageService.getSectionProperties({
    sectionId,
    page,
    limit,
    city,
    destination,
    searchContext: destination || city ? {
      query: destination || city || "",
      city: city || null,
      displayName: destination || city || "",
      placeType: "city",
      checkIn: checkIn || null,
      checkOut: checkOut || null,
      guests,
    } : null,
    userId: user?.id,
  });

  return ok(data);
});
