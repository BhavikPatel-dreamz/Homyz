"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { updateHostPublicProfileSchema } from "@/lib/validation/host-profile";
import { userService } from "@/services/user.service";

import { prisma } from "@/lib/db/prisma";

export async function updateHostPublicProfileAction(input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();

    let listingId: string | undefined;
    let rawProfile = input;

    if (typeof input === "object" && input !== null) {
      if ("profile" in input && typeof (input as any).profile === "object" && (input as any).profile !== null) {
        listingId = typeof (input as any).listingId === "string" ? (input as any).listingId : undefined;
        rawProfile = (input as any).profile;
      } else if ("listingId" in input) {
        const { listingId: extractedId, ...rest } = input as Record<string, unknown>;
        listingId = typeof extractedId === "string" ? extractedId : undefined;
        rawProfile = rest;
      }
    }

    let targetUserId = actor.id;

    if (listingId) {
      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: {
          id: true,
          hostId: true,
          customSlug: true,
          coHosts: { where: { status: "ACCEPTED" }, select: { userId: true } },
        },
      });
      if (!listing) throw AppError.notFound("Listing not found");

      const isOwner = listing.hostId === actor.id;
      const isAdmin = actor.role === "ADMIN";
      const isCoHost = listing.coHosts.some((ch: { userId: string }) => ch.userId === actor.id);

      if (!isOwner && !isAdmin && !isCoHost) {
        throw AppError.forbidden("You do not have permission to edit this listing's host profile");
      }
      targetUserId = listing.hostId;
    }

    const validatedProfile = updateHostPublicProfileSchema.parse(rawProfile);
    const profile = await userService.updateHostPublicProfile(
      targetUserId,
      validatedProfile,
    );

    revalidatePath("/host/listings", "layout");
    revalidatePath("/listings", "layout");
    revalidatePath("/profile");
    revalidatePath("/profile-management");
    if (listingId) {
      revalidatePath(`/host/listings/${listingId}`);
      revalidatePath(`/admin/listings/${listingId}`);
    }

    return profile;
  });
}

export async function updateHostListingPhotoAction(input: { listingId: string; image: string }) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();

    const listing = await prisma.listing.findUnique({
      where: { id: input.listingId },
      select: {
        id: true,
        hostId: true,
        customSlug: true,
        coHosts: { where: { status: "ACCEPTED" }, select: { userId: true } },
      },
    });
    if (!listing) throw AppError.notFound("Listing not found");

    const isOwner = listing.hostId === actor.id;
    const isAdmin = actor.role === "ADMIN";
    const isCoHost = listing.coHosts.some((ch: { userId: string }) => ch.userId === actor.id);

    if (!isOwner && !isAdmin && !isCoHost) {
      throw AppError.forbidden("You do not have permission to edit this listing's host photo");
    }

    const updated = await userService.updateProfile(listing.hostId, { image: input.image });
    revalidatePath(`/host/listings/${input.listingId}`);
    revalidatePath(`/admin/listings/${input.listingId}`);
    revalidatePath("/profile");
    revalidatePath("/profile-management");
    return updated;
  });
}
