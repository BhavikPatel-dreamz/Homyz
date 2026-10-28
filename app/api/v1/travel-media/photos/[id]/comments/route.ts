import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { AppError } from "@/lib/api/errors";
import { createPhotoComment, getPhotoComments } from "@/services/travel-social.service";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/v1/travel-media/photos/[id]/comments">) {
  try {
    const actor = await getAuthContext(req);
    const { id } = await ctx.params;
    const data = await getPhotoComments(actor?.id, id, {
      cursor: req.nextUrl.searchParams.get("cursor") || undefined,
      limit: Number(req.nextUrl.searchParams.get("limit")) || 20,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[travel-social] comments lookup failed", error);
    return NextResponse.json({ error: "Failed to load comments." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/v1/travel-media/photos/[id]/comments">) {
  try {
    const actor = await getAuthContext(req);
    if (!actor?.id) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const comment = await createPhotoComment(actor.id, id, body.content);
    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[travel-social] comment creation failed", error);
    return NextResponse.json({ error: "Failed to add comment." }, { status: 500 });
  }
}
