import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { searchTaggableTravelUsers } from "@/services/travel-photo.service";

export async function GET(request: Request) {
  try {
    const actor = await getSessionUser();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() || "";

    // This endpoint is used by travel-photo tagging. Never return private or
    // blocked accounts (including through a direct request).
    const users = await searchTaggableTravelUsers(actor.id, query);

    return NextResponse.json({ users });
  } catch (error: unknown) {
    console.error("[USERS_SEARCH_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
