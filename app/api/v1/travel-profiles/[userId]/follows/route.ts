import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { AppError } from "@/lib/api/errors";
import { getTravelFollowList } from "@/services/travel-privacy.service";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/v1/travel-profiles/[userId]/follows">) {
  try {
    const actor = await getAuthContext(req);
    const { userId } = await ctx.params;
    const kind = req.nextUrl.searchParams.get("kind") === "following" ? "following" : "followers";
    return NextResponse.json(await getTravelFollowList(actor?.id, userId, kind, {
      search: req.nextUrl.searchParams.get("search") || undefined,
      cursor: req.nextUrl.searchParams.get("cursor") || undefined,
      limit: Number(req.nextUrl.searchParams.get("limit")) || 20,
    }));
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Failed to load follow list." }, { status: 500 });
  }
}
