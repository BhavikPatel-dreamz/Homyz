import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { guidebookService } from "@/services/guidebook.service";
import { updateGuidebookSchema } from "@/lib/validation/guidebook";
import { AppError } from "@/lib/api/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const actor = await getSessionUser();
    const guidebook = await guidebookService.getPublicGuidebook(id, actor?.id);
    return NextResponse.json({ guidebook });
  } catch (err: unknown) {
    console.error(`GET /api/v1/guidebooks/[id] error:`, err);
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Guidebook not found" }, { status: 404 });
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const actor = await getSessionUser();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const data = updateGuidebookSchema.parse(body);
    const updated = await guidebookService.update(actor, id, data);
    return NextResponse.json({ guidebook: updated });
  } catch (err: unknown) {
    console.error(`PATCH /api/v1/guidebooks/[id] error:`, err);
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed to update guidebook" }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const actor = await getSessionUser();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await guidebookService.remove(actor, id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error(`DELETE /api/v1/guidebooks/[id] error:`, err);
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed to delete guidebook" }, { status: 400 });
  }
}
