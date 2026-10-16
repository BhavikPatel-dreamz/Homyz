import { createHash, randomBytes } from "node:crypto";
import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import { sendListingCoHostInvitationEmail } from "@/lib/services/email";
import { sendListingCoHostInvitationSms } from "@/lib/services/sms";
import { isValidE164Phone, normalizePhone } from "@/lib/auth/normalization";
import { ListingCoHostStatus, Role } from "@/generated/prisma/enums";
import type { ListingCoHost, User } from "@/generated/prisma/client";
import type { CoHostInvitationInput } from "@/lib/validation/host-profile";

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function appUrl() {
  return process.env.APP_URL ?? "http://localhost:3000";
}

function toOwnerCoHost(value: ListingCoHost & { user: Pick<User, "id" | "name" | "image"> | null }) {
  return {
    id: value.id,
    email: value.email,
    phone: value.phone,
    status: value.status,
    invitedAt: value.invitedAt,
    expiresAt: value.expiresAt,
    acceptedAt: value.acceptedAt,
    user: value.user ? { id: value.user.id, name: value.user.name, image: value.user.image } : null,
  };
}

async function expirePendingForListing(listingId: string) {
  await prisma.listingCoHost.updateMany({
    where: { listingId, status: ListingCoHostStatus.PENDING, expiresAt: { lte: new Date() } },
    data: { status: ListingCoHostStatus.EXPIRED },
  });
}

async function listForOwner(actor: AuthUser, listingId: string) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId }, select: { hostId: true } });
  if (!listing) throw AppError.notFound("Listing not found");
  if (actor.role !== Role.ADMIN && listing.hostId !== actor.id) throw AppError.forbidden("Only the listing owner can view co-host invitations");
  await expirePendingForListing(listingId);
  const rows = await prisma.listingCoHost.findMany({
    where: { listingId },
    orderBy: { invitedAt: "desc" },
    include: { user: { select: { id: true, name: true, image: true } } },
  });
  return rows.map(toOwnerCoHost);
}

async function invite(actor: AuthUser, listingId: string, input: CoHostInvitationInput) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { host: { select: { name: true, email: true, phone: true } } },
  });
  if (!listing) throw AppError.notFound("Listing not found");
  if (actor.role !== Role.ADMIN && listing.hostId !== actor.id) throw AppError.forbidden("Only the listing owner can invite a co-host");

  const email = input.email?.toLowerCase().trim() || null;
  const phone = input.phone ? normalizePhone(input.phone) : null;
  if (phone && !isValidE164Phone(phone)) {
    throw AppError.validation("Enter a valid phone number including its country code");
  }
  if (
    (email && (listing.host.email?.toLowerCase() === email || actor.email?.toLowerCase() === email)) ||
    (phone && listing.host.phone && normalizePhone(listing.host.phone) === phone)
  ) {
    throw AppError.badRequest("You cannot invite yourself as a co-host");
  }

  await expirePendingForListing(listingId);
  const existing = await prisma.listingCoHost.findFirst({
    where: {
      listingId,
      ...(email ? { email } : { phone: phone! }),
    },
    include: { user: { select: { id: true, name: true, image: true } } },
  });
  if (existing?.status === ListingCoHostStatus.PENDING || existing?.status === ListingCoHostStatus.ACCEPTED) {
    throw AppError.conflict("This person already has a pending or accepted co-host invitation");
  }

  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS);
  const invitation = existing
    ? await prisma.listingCoHost.update({
        where: { id: existing.id },
        data: {
          inviterHostId: listing.hostId,
          email,
          phone,
          userId: null,
          tokenHash: hashToken(rawToken),
          status: ListingCoHostStatus.PENDING,
          invitedAt: new Date(),
          expiresAt,
          acceptedAt: null,
          declinedAt: null,
          revokedAt: null,
        },
        include: { user: { select: { id: true, name: true, image: true } } },
      })
    : await prisma.listingCoHost.create({
        data: {
          listingId,
          inviterHostId: listing.hostId,
          email,
          phone,
          tokenHash: hashToken(rawToken),
          status: ListingCoHostStatus.PENDING,
          expiresAt,
        },
        include: { user: { select: { id: true, name: true, image: true } } },
      });
  const invitationUrl = `${appUrl()}/co-host-invitations/accept?token=${encodeURIComponent(rawToken)}`;
  try {
    if (email) {
      await sendListingCoHostInvitationEmail({
        to: email,
        hostName: listing.host.name,
        listingTitle: listing.title,
        invitationUrl,
      });
    } else if (phone) {
      await sendListingCoHostInvitationSms({
        to: phone,
        hostName: listing.host.name,
        listingTitle: listing.title,
        invitationUrl,
      });
    }
  } catch {
    await prisma.listingCoHost.update({
      where: { id: invitation.id },
      data: { status: ListingCoHostStatus.REVOKED, revokedAt: new Date(), tokenHash: null },
    });
    if (email) {
      throw AppError.badRequest(
        "We couldn't send the invitation email. Check the address and try again.",
      );
    }
    throw AppError.badRequest(
      "We couldn't send the text invitation. Check the phone number and try again.",
    );
  }
  return toOwnerCoHost(invitation);
}

async function revoke(actor: AuthUser, listingId: string, invitationId: string) {
  const invitation = await prisma.listingCoHost.findUnique({
    where: { id: invitationId },
    include: { listing: { select: { hostId: true } } },
  });
  if (!invitation || invitation.listingId !== listingId) throw AppError.notFound("Co-host invitation not found");
  if (actor.role !== Role.ADMIN && invitation.listing.hostId !== actor.id) throw AppError.forbidden("Only the listing owner can remove a co-host");
  if (invitation.status !== ListingCoHostStatus.PENDING && invitation.status !== ListingCoHostStatus.ACCEPTED) {
    throw AppError.badRequest("This co-host invitation can no longer be removed");
  }
  const updated = await prisma.listingCoHost.update({
    where: { id: invitationId },
    data: { status: ListingCoHostStatus.REVOKED, revokedAt: new Date(), tokenHash: null },
    include: { user: { select: { id: true, name: true, image: true } } },
  });
  return toOwnerCoHost(updated);
}

async function accept(actor: AuthUser, rawToken: string) {
  const invitation = await prisma.listingCoHost.findUnique({ where: { tokenHash: hashToken(rawToken.trim()) } });
  if (!invitation) throw AppError.notFound("This co-host invitation is invalid or has already been used");
  if (invitation.status !== ListingCoHostStatus.PENDING) throw AppError.badRequest("This co-host invitation is no longer pending");
  if (!invitation.expiresAt || invitation.expiresAt <= new Date()) {
    await prisma.listingCoHost.update({ where: { id: invitation.id }, data: { status: ListingCoHostStatus.EXPIRED, tokenHash: null } });
    throw AppError.badRequest("This co-host invitation has expired");
  }
  const recipient = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { email: true, phone: true },
  });
  const matchesEmail = Boolean(
    invitation.email && recipient?.email && invitation.email.toLowerCase() === recipient.email.toLowerCase(),
  );
  const matchesPhone = Boolean(
    invitation.phone && recipient?.phone && normalizePhone(invitation.phone) === normalizePhone(recipient.phone),
  );
  if (!matchesEmail && !matchesPhone) {
    throw AppError.forbidden("Sign in with the email address or phone number that received this invitation");
  }
  const listing = await prisma.listing.findUnique({ where: { id: invitation.listingId }, select: { hostId: true } });
  if (!listing || listing.hostId === actor.id) throw AppError.badRequest("The listing owner cannot accept this co-host invitation");
  const updated = await prisma.listingCoHost.update({
    where: { id: invitation.id },
    data: { userId: actor.id, status: ListingCoHostStatus.ACCEPTED, acceptedAt: new Date(), tokenHash: null },
  });
  return { id: updated.id, listingId: updated.listingId, status: updated.status };
}

export const listingCoHostService = { listForOwner, invite, revoke, accept };
