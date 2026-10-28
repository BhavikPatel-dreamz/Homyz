import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { createTrip, getUserTrips } from "@/services/travel-photo.service";
import {
  getOrCreateDestination,
  normalizeCityName,
  normalizeCountry,
} from "@/services/travel-destination.service";
import { AppError } from "@/lib/api/errors";

export async function GET(req: NextRequest) {
  try {
    const actor = await getAuthContext(req);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trips = await getUserTrips(actor.id);
    return NextResponse.json({ trips });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[travel-media] trips lookup failed:", err);
    return NextResponse.json(
      { error: "Failed to retrieve trips." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthContext(req);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    let destinationId =
      typeof body.destinationId === "string" ? body.destinationId : null;
    if (!destinationId && typeof body.country === "string") {
      const country = normalizeCountry(body.country);
      if (!country)
        throw AppError.badRequest("Choose a valid destination country.");
      const destination = await getOrCreateDestination({
        ...country,
        cityName: normalizeCityName(
          typeof body.city === "string" ? body.city : null,
        ),
      });
      destinationId = destination.id;
    }
    const trip = await createTrip(actor.id, {
      title: typeof body.title === "string" ? body.title : "",
      destinationId,
      startDate: typeof body.startDate === "string" ? body.startDate : null,
      endDate: typeof body.endDate === "string" ? body.endDate : null,
    });

    return NextResponse.json({ trip }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[travel-media] trip creation failed:", err);
    return NextResponse.json(
      { error: "Failed to create trip." },
      { status: 500 },
    );
  }
}
