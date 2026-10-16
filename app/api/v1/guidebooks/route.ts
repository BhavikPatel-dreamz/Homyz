import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { guidebookService } from "@/services/guidebook.service";
import { createGuidebookSchema } from "@/lib/validation/guidebook";
import { AppError } from "@/lib/api/errors";

export async function GET() {
  try {
    const actor = await getSessionUser();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const guidebooks = await guidebookService.getGuidebooksForHost(actor);
    return NextResponse.json({ guidebooks });
  } catch (err: unknown) {
    console.error("GET /api/v1/guidebooks error:", err);
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const actor = await getSessionUser();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const data = createGuidebookSchema.parse(body);
    const guidebook = await guidebookService.create(actor, data);
    return NextResponse.json({ guidebook }, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/v1/guidebooks error:", err);
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Invalid guidebook payload" }, { status: 400 });
  }
}
