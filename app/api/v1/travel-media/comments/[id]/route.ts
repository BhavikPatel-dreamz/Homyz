import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { AppError } from "@/lib/api/errors";
import { deletePhotoComment, updatePhotoComment } from "@/services/travel-social.service";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getAuthContext(req);
    if (!actor?.id) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ comment: await updatePhotoComment(actor.id, id, body.content) });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Failed to update comment." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getAuthContext(req);
    if (!actor?.id) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { id } = await ctx.params;
    await deletePhotoComment(actor.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Failed to delete comment." }, { status: 500 });
  }
}
