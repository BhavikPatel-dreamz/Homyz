import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  deletePublicMedia,
  parseManagedMediaUrl,
} from "@/lib/storage/media";
import { getAuthContext } from "@/lib/auth/context";

export async function DELETE(req: NextRequest) {
  try {
    const actor = await getAuthContext(req);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
    const url = typeof body?.url === "string" ? body.url : "";
    const parsed = parseManagedMediaUrl(url);

    if (!parsed || parsed.visibility !== "public") {
      return NextResponse.json(
        { error: "Not a managed public media URL." },
        { status: 400 },
      );
    }

    await deletePublicMedia({
      kind: parsed.kind as "listing-photos" | "stamp-icons" | "guidebook-photos",
      fileName: parsed.fileName,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Media delete error:", err);
    const message = err instanceof Error ? err.message : "Failed to delete media.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
