"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { coHostInvitationSchema } from "@/lib/validation/host-profile";
import { listingCoHostService } from "@/services/listing-cohost.service";

export async function inviteListingCoHostAction(listingId: string, input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const result = await listingCoHostService.invite(actor, listingId, coHostInvitationSchema.parse(input));
    revalidatePath(`/host/listings/${listingId}`);
    return result;
  });
}

export async function revokeListingCoHostAction(listingId: string, invitationId: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const result = await listingCoHostService.revoke(actor, listingId, invitationId);
    revalidatePath(`/host/listings/${listingId}`);
    return result;
  });
}

export async function acceptListingCoHostAction(token: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    return listingCoHostService.accept(actor, token);
  });
}
