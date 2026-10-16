import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/api/errors";
import { listingService } from "@/services/listing.service";
import { removeListingInputSchema } from "@/lib/validation/listing-removal";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getSessionUser();
    if (!actor) {
      return NextResponse.json(
        { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
        { status: 401 }
      );
    }

    const { id: listingId } = await params;
    const body = await req.json().catch(() => ({}));
    const validated = removeListingInputSchema.parse({
      ...body,
      listingId,
    });

    const result = await listingService.remove(actor, listingId, {
      categories: validated.categories,
      reasons: validated.reasons,
      customFeedback: validated.customFeedback,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: { message: err.message, code: err.code } },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: { message: err.message || "Failed to remove listing" } },
      { status: 400 }
    );
  }
}
