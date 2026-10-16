import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  deletePublicMedia,
  parseManagedMediaUrl,
} from "@/lib/storage/media";
import { getAuthContext } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { Role } from "@/generated/prisma/enums";

async function actorOwnsReferencedPublicMedia(actorId: string, isAdmin: boolean, url: string, kind: string) {
  if (kind === "listing-photos") {
    return prisma.listing.findFirst({
      where: {
        ...(isAdmin ? {} : { hostId: actorId }),
        photos: { has: url },
      },
      select: { id: true },
    });
  }

  return prisma.guidebook.findFirst({
    where: {
      ...(isAdmin ? {} : { hostId: actorId }),
      OR: [
        { coverImage: url },
        { items: { some: { photo: url } } },
        { items: { some: { photos: { has: url } } } },
      ],
    },
    select: { id: true },
  });
}

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

    // The object key is not an authorization token. Only an owner (or an
    // administrator) may delete media that is currently referenced by a
    // resource they can manage. Normal listing/guidebook updates perform
    // their own server-side cleanup, so unreferenced object deletion is never
    // exposed as a browser capability.
    const referencedResource = await actorOwnsReferencedPublicMedia(
      actor.id,
      actor.role === Role.ADMIN,
      url,
      parsed.kind,
    );
    if (!referencedResource) {
      return NextResponse.json({ error: "You cannot delete this media." }, { status: 403 });
    }

    await deletePublicMedia({
      kind: parsed.kind as "listing-photos" | "guidebook-photos",
      fileName: parsed.fileName,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[upload] public media deletion failed");
    return NextResponse.json({ error: "Failed to delete media." }, { status: 500 });
  }
}
