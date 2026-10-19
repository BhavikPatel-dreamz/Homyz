import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { userDestinationService } from "@/services/user-destination.service";
import { travelBookingSyncService } from "@/services/travel-booking-sync.service";
import { addSelfDeclaredDestinationSchema } from "@/lib/validation/travel-trip";

export const dynamic = "force-dynamic";

/** Retrieves the authenticated owner's visited destinations with verification status. */
export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  // A user-scoped, idempotent reconciliation keeps historical completed stays
  // visible without a production-wide backfill or fabricated destinations.
  await travelBookingSyncService.syncUserAllBookings(actor.id);
  const destinations = await userDestinationService.getUserDestinations(actor.id);
  return NextResponse.json(
    { destinations },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});

/** Adds a self-declared destination manually selected by the traveler. */
export const POST = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const json = await req.json();
  const input = addSelfDeclaredDestinationSchema.parse(json);

  const destination = await userDestinationService.addSelfDeclaredDestination(actor.id, input);
  return NextResponse.json(
    { destination },
    {
      status: 201,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
});
