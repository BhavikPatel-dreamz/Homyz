import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { travelDestinationService } from "@/services/travel-destination.service";
import { destinationSearchQuerySchema } from "@/lib/validation/travel-trip";

export const dynamic = "force-dynamic";

/** Searches canonical destinations using DB cache and global geography database. */
export const GET = apiHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const { q, limit } = destinationSearchQuerySchema.parse({
    q: searchParams.get("q") || "",
    limit: searchParams.get("limit") || 10,
  });

  const destinations = await travelDestinationService.searchDestinations(q, limit);
  return NextResponse.json({ destinations }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
});

