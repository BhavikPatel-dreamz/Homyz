import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { hostGuestInsightsService } from "@/services/host-guest-insights.service";

export const dynamic = "force-dynamic";

export const POST = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const actor = await requireApiAuth(req);
    const { id: bookingId } = await ctx.params;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, userId: true, listingId: true, status: true, listing: { select: { checkInInstructions: true } } },
    });

    if (!booking) throw AppError.notFound("Booking not found");

    // Only authorized guest can track instruction viewing
    if (booking.userId !== actor.id) {
      throw AppError.forbidden("Only the booked guest can view check-in instructions.");
    }
    if (booking.status !== "CONFIRMED" || !booking.listing.checkInInstructions) {
      throw AppError.notFound("Check-in instructions are not available for this booking.");
    }

    await hostGuestInsightsService.recordCheckInViewed({
      reservationId: booking.id,
      listingId: booking.listingId,
      guestId: actor.id,
    });

    return NextResponse.json({
      success: true,
      message: "Check-in instruction view tracked.",
    });
  },
);
