import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readPublicMediaFile, type PublicMediaKind } from "@/lib/storage/media";

const PUBLIC_KINDS = new Set<PublicMediaKind>([
  "listing-photos",
  "stamp-icons",
  "guidebook-photos",
]);

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  if (!path || path.length !== 2) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [kind, fileName] = path;
  if (!PUBLIC_KINDS.has(kind as PublicMediaKind)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const file = await readPublicMediaFile(kind as PublicMediaKind, fileName);
    if (!file) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(file.body), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("Public media proxy error:", err);
    return NextResponse.json({ error: "Media unavailable." }, { status: 502 });
  }
}
