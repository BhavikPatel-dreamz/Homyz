import "server-only";

import { nanoid } from "nanoid";
import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getSupportSlaDeadlines } from "@/lib/support-case/sla";
import { enqueueSupportNotification, processNotificationOutboxBatch } from "@/services/notification-outbox.service";
import {
  ResolutionOfferStatus,
  ResolutionOfferType,
  Role,
  SupportCaseContentVisibility,
  SupportCaseParticipantRole,
  SupportCasePriority,
  SupportCaseStatus,
} from "@/generated/prisma/enums";

const MAX_NEGOTIATION_ROUNDS = 8;

async function deliverCommittedResolutionNotifications() {
  try {
    await processNotificationOutboxBatch({ limit: 25 });
  } catch (error) {
    console.warn("[resolution] notification delivery will be retried by the outbox worker", error);
  }
}

async function resolutionCaseLink(tx: Prisma.TransactionClient, userId: string, caseId: string) {
  const recipient = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
  return recipient?.role === Role.HOST
    ? `/host/support?view=direct&caseId=${encodeURIComponent(caseId)}`
    : `/profile/tab/support?view=direct&caseId=${encodeURIComponent(caseId)}`;
}

async function resolutionReviewers(tx: Prisma.TransactionClient, actorId: string) {
  return tx.user.findMany({
    where: {
      role: Role.ADMIN,
      status: "ACTIVE",
      id: { not: actorId },
      adminRole: { permissions: { some: { permission: { slug: { in: [PERMISSIONS.DISPUTES_MANAGE, PERMISSIONS.DISPUTES_VIEW] } } } } },
    },
    select: { id: true },
    take: 25,
  });
}

type CreateOfferInput = {
  offerType: ResolutionOfferType;
  amount?: number;
  currency?: string;
  description: string;
  expiresAt?: Date;
  recipientId?: string;
  idempotencyKey?: string;
  parentOfferId?: string;
};

function cleanText(value: string | undefined, field: string, max = 4_000) {
  const cleaned = value?.trim();
  if (!cleaned) throw AppError.badRequest(`${field} is required.`);
  if (cleaned.length > max) throw AppError.badRequest(`${field} must be at most ${max} characters.`);
  return cleaned;
}

function offerValues(input: CreateOfferInput) {
  const description = cleanText(input.description, "Offer description");
  const currency = (input.currency || "SAR").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw AppError.badRequest("Currency must be a three-letter ISO code.");
  const isMonetary = input.offerType === ResolutionOfferType.MONETARY_COMPENSATION || input.offerType === ResolutionOfferType.PROPERTY_DAMAGE;
  if (isMonetary && (!Number.isInteger(input.amount) || !input.amount || input.amount < 1)) throw AppError.badRequest("A positive minor-unit amount is required for monetary offers.");
  if (!isMonetary && input.amount !== undefined) throw AppError.badRequest("Non-financial offers cannot include an amount.");
  if (input.expiresAt && input.expiresAt.getTime() <= Date.now()) throw AppError.badRequest("Offer expiration must be in the future.");
  if (input.idempotencyKey && (input.idempotencyKey.length < 8 || input.idempotencyKey.length > 200)) throw AppError.badRequest("Idempotency key must be between 8 and 200 characters.");
  return { description, currency, amount: isMonetary ? input.amount! : null };
}

async function assertCaseAccess(tx: Prisma.TransactionClient, actor: AuthUser, caseId: string) {
  const supportCase = await tx.supportCase.findUnique({
    where: { id: caseId },
    include: { participants: { where: { userId: actor.id, removedAt: null, canView: true }, select: { userId: true, role: true, canPost: true } } },
  });
  if (!supportCase) throw AppError.notFound("Support case not found.");
  if (actor.role === Role.ADMIN) return { supportCase, participant: null };
  const participant = supportCase.participants[0];
  if (!participant) throw AppError.forbidden("You do not have access to this resolution request.");
  return { supportCase, participant };
}

async function ensureBookingParticipants(tx: Prisma.TransactionClient, supportCase: { id: string; bookingId: string | null; reporterId: string | null }, actor: AuthUser) {
  if (!supportCase.bookingId) throw AppError.badRequest("A resolution request must be linked to a booking.");
  const booking = await tx.booking.findUnique({ where: { id: supportCase.bookingId }, select: { id: true, userId: true, listing: { select: { hostId: true } } } });
  if (!booking) throw AppError.notFound("Booking not found.");
  const isGuest = booking.userId === actor.id;
  const isHost = booking.listing.hostId === actor.id;
  if (actor.role !== Role.ADMIN && !isGuest && !isHost) throw AppError.forbidden("Only this booking's guest or host can negotiate a resolution.");
  const recipientId = isGuest ? booking.listing.hostId : booking.userId;
  if (!recipientId) throw AppError.badRequest("This booking has no eligible resolution recipient.");
  if (actor.role !== Role.ADMIN) {
    await tx.supportCaseParticipant.upsert({ where: { caseId_userId: { caseId: supportCase.id, userId: actor.id } }, create: { caseId: supportCase.id, userId: actor.id, role: SupportCaseParticipantRole.REPORTER }, update: { canView: true, canPost: true, removedAt: null } });
    await tx.supportCaseParticipant.upsert({ where: { caseId_userId: { caseId: supportCase.id, userId: recipientId } }, create: { caseId: supportCase.id, userId: recipientId, role: isGuest ? SupportCaseParticipantRole.HOST : SupportCaseParticipantRole.GUEST }, update: { canView: true, canPost: true, removedAt: null } });
  }
  return { booking, recipientId };
}

async function createResolutionOffer(actor: AuthUser, caseId: string, input: CreateOfferInput) {
  const values = offerValues(input);
  if (input.idempotencyKey) {
    const existing = await prisma.resolutionOffer.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.proposerId !== actor.id || existing.caseId !== caseId) throw AppError.conflict("This resolution request key is already in use.");
      return existing;
    }
  }
  const created = await prisma.$transaction(async (tx) => {
    const access = await assertCaseAccess(tx, actor, caseId);
    if (actor.role !== Role.ADMIN && !access.participant?.canPost) throw AppError.forbidden("You cannot post to this resolution request.");
    const { booking, recipientId } = await ensureBookingParticipants(tx, access.supportCase, actor);
    const targetId = actor.role === Role.ADMIN ? input.recipientId : recipientId;
    if (!targetId) throw AppError.badRequest("An eligible resolution recipient is required.");
    if (targetId === actor.id) throw AppError.badRequest("A resolution offer must be sent to another participant.");
    const targetParticipant = await tx.supportCaseParticipant.findFirst({ where: { caseId, userId: targetId, removedAt: null, canView: true }, select: { id: true } });
    if (!targetParticipant) throw AppError.forbidden("The recipient is not an authorized support-case participant.");
    if (input.parentOfferId) {
      const parent = await tx.resolutionOffer.findUnique({ where: { id: input.parentOfferId } });
      if (!parent || parent.caseId !== caseId || parent.status !== ResolutionOfferStatus.PENDING || parent.recipientId !== actor.id || (parent.expiresAt && parent.expiresAt <= new Date())) throw AppError.conflict("This offer cannot be countered.");
      const rounds = await tx.resolutionOffer.count({ where: { caseId, parentOfferId: { not: null } } });
      if (rounds >= MAX_NEGOTIATION_ROUNDS) throw AppError.conflict("This negotiation reached its maximum number of counteroffers. Request mediation instead.");
      const changed = await tx.resolutionOffer.updateMany({ where: { id: parent.id, status: ResolutionOfferStatus.PENDING, version: parent.version }, data: { status: ResolutionOfferStatus.COUNTERED, version: { increment: 1 } } });
      if (changed.count !== 1) throw AppError.conflict("This offer changed before your counteroffer was submitted.");
    }
    const offer = await tx.resolutionOffer.create({ data: { caseId, bookingId: booking.id, parentOfferId: input.parentOfferId || null, proposerId: actor.id, recipientId: targetId, offerType: input.offerType, amount: values.amount, currency: values.currency, description: values.description, expiresAt: input.expiresAt || null, idempotencyKey: input.idempotencyKey } });
    await tx.supportCaseEvent.create({ data: { caseId, actorId: actor.id, eventType: input.parentOfferId ? "RESOLUTION_COUNTEROFFERED" : "RESOLUTION_OFFER_CREATED", visibility: SupportCaseContentVisibility.PARTICIPANTS, description: input.parentOfferId ? "A counteroffer was submitted." : "A resolution offer was submitted." } });
    await tx.auditLog.create({ data: { actorId: actor.id, actorEmail: actor.email, action: input.parentOfferId ? "RESOLUTION_OFFER_COUNTERED" : "RESOLUTION_OFFER_CREATED", resourceType: "SUPPORT_CASE", resourceId: caseId, description: "Resolution offer recorded.", status: "SUCCESS", metadata: { resolutionOfferId: offer.id, bookingId: booking.id, offerType: offer.offerType, amount: offer.amount } } });
    await enqueueSupportNotification(tx, { eventType: input.parentOfferId ? "RESOLUTION_COUNTEROFFER_SUBMITTED" : "RESOLUTION_OFFER_SUBMITTED", entityType: "RESOLUTION_OFFER", entityId: offer.id, idempotencyKey: `resolution-offer:created:${offer.id}`, recipients: [{ userId: targetId, title: input.parentOfferId ? "New resolution counteroffer" : "New resolution offer", message: "A booking participant submitted a resolution offer.", link: await resolutionCaseLink(tx, targetId, caseId) }] });
    return offer;
  });
  await deliverCommittedResolutionNotifications();
  return created;
}

async function actOnResolutionOffer(actor: AuthUser, offerId: string, input: { action: "ACCEPT" | "REJECT" | "WITHDRAW"; expectedVersion: number }) {
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) throw AppError.badRequest("A valid expectedVersion is required.");
  const outcome = await prisma.$transaction(async (tx) => {
    const offer = await tx.resolutionOffer.findUnique({ where: { id: offerId }, include: { supportCase: true } });
    if (!offer) throw AppError.notFound("Resolution offer not found.");
    await assertCaseAccess(tx, actor, offer.caseId);
    if (offer.status !== ResolutionOfferStatus.PENDING) throw AppError.conflict("This resolution offer is no longer pending.");
    if (offer.expiresAt && offer.expiresAt <= new Date()) {
      const expired = await tx.resolutionOffer.update({ where: { id: offer.id }, data: { status: ResolutionOfferStatus.EXPIRED, version: { increment: 1 } } });
      await tx.supportCaseEvent.create({ data: { caseId: offer.caseId, eventType: "RESOLUTION_OFFER_EXPIRED", visibility: SupportCaseContentVisibility.PARTICIPANTS, description: "A resolution offer expired." } });
      await enqueueSupportNotification(tx, { eventType: "RESOLUTION_OFFER_EXPIRED", entityType: "RESOLUTION_OFFER", entityId: offer.id, idempotencyKey: `resolution-offer:expired:${offer.id}:${expired.version}`, recipients: [{ userId: offer.proposerId, title: "Resolution offer expired", message: "Your resolution offer expired without a response.", link: await resolutionCaseLink(tx, offer.proposerId, offer.caseId) }] });
      return { expired: true as const, offer: expired };
    }
    const allowed = input.action === "WITHDRAW" ? offer.proposerId === actor.id : offer.recipientId === actor.id;
    if (!allowed && actor.role !== Role.ADMIN) throw AppError.forbidden("You cannot perform this action on this resolution offer.");
    if (offer.version !== input.expectedVersion) throw AppError.conflict("This resolution offer changed since it was loaded. Refresh before continuing.");
    const now = new Date();
    const status = input.action === "ACCEPT" ? ResolutionOfferStatus.ACCEPTED : input.action === "REJECT" ? ResolutionOfferStatus.REJECTED : ResolutionOfferStatus.WITHDRAWN;
    const changed = await tx.resolutionOffer.updateMany({ where: { id: offer.id, version: input.expectedVersion, status: ResolutionOfferStatus.PENDING }, data: { status, acceptedAt: status === ResolutionOfferStatus.ACCEPTED ? now : null, rejectedAt: status === ResolutionOfferStatus.REJECTED ? now : null, withdrawnAt: status === ResolutionOfferStatus.WITHDRAWN ? now : null, version: { increment: 1 } } });
    if (changed.count !== 1) throw AppError.conflict("This resolution offer changed since it was loaded. Refresh before continuing.");
    const updated = await tx.resolutionOffer.findUniqueOrThrow({ where: { id: offer.id } });
    await tx.supportCaseEvent.create({ data: { caseId: offer.caseId, actorId: actor.id, eventType: `RESOLUTION_OFFER_${status}`, visibility: SupportCaseContentVisibility.PARTICIPANTS, description: status === ResolutionOfferStatus.ACCEPTED ? "A resolution agreement was recorded; payment is not implied." : `A resolution offer was ${status.toLowerCase()}.` } });
    await tx.auditLog.create({ data: { actorId: actor.id, actorEmail: actor.email, action: `RESOLUTION_OFFER_${status}`, resourceType: "SUPPORT_CASE", resourceId: offer.caseId, description: `Resolution offer ${status.toLowerCase()}.`, status: "SUCCESS", metadata: { resolutionOfferId: offer.id, expectedVersion: input.expectedVersion } } });
    const recipient = offer.proposerId === actor.id ? offer.recipientId : offer.proposerId;
    await enqueueSupportNotification(tx, { eventType: `RESOLUTION_OFFER_${status}`, entityType: "RESOLUTION_OFFER", entityId: offer.id, idempotencyKey: `resolution-offer:${status.toLowerCase()}:${offer.id}:${updated.version}`, recipients: [{ userId: recipient, title: "Resolution offer updated", message: `A resolution offer was ${status.toLowerCase()}.`, link: await resolutionCaseLink(tx, recipient, offer.caseId) }] });
    return { expired: false as const, offer: updated, recipient, event: status.toLowerCase() };
  });
  await deliverCommittedResolutionNotifications();
  if (outcome.expired) throw AppError.conflict("This resolution offer has expired.");
  return outcome.offer;
}

async function requestResolutionMediation(actor: AuthUser, caseId: string, input: { expectedVersion: number; reason: string }) {
  const reason = cleanText(input.reason, "Mediation reason", 2_000);
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) throw AppError.badRequest("A valid expectedVersion is required.");
  const updated = await prisma.$transaction(async (tx) => {
    const access = await assertCaseAccess(tx, actor, caseId);
    if (actor.role !== Role.ADMIN && !access.participant?.canPost) throw AppError.forbidden("You cannot request mediation for this case.");
    if (access.supportCase.version !== input.expectedVersion) throw AppError.conflict("This support case changed since it was loaded. Refresh before requesting mediation.");
    if (
      access.supportCase.status === SupportCaseStatus.CLOSED ||
      access.supportCase.status === SupportCaseStatus.RESOLVED
    ) throw AppError.conflict("Mediation cannot be requested for a closed support case.");
    const activeMediation = await tx.supportCaseEvent.findFirst({
      where: { caseId, eventType: "MEDIATION_REQUESTED" },
      select: { id: true },
    });
    if (activeMediation && access.supportCase.status === SupportCaseStatus.ESCALATED) {
      throw AppError.conflict("Mediation is already active for this resolution request.");
    }
    const supportCase = await tx.supportCase.update({ where: { id: caseId }, data: { status: SupportCaseStatus.ESCALATED, escalationLevel: Math.max(access.supportCase.escalationLevel || 0, 2), escalationReason: reason, escalatedAt: new Date(), version: { increment: 1 } } });
    await tx.supportCaseEvent.create({ data: { caseId, actorId: actor.id, eventType: "MEDIATION_REQUESTED", visibility: SupportCaseContentVisibility.PARTICIPANTS, description: "Admin mediation was requested." } });
    await tx.auditLog.create({ data: { actorId: actor.id, actorEmail: actor.email, action: "RESOLUTION_MEDIATION_REQUESTED", resourceType: "SUPPORT_CASE", resourceId: caseId, description: "Resolution mediation requested.", status: "SUCCESS", metadata: { reason } } });
    const admins = await resolutionReviewers(tx, actor.id);
    await enqueueSupportNotification(tx, { eventType: "RESOLUTION_MEDIATION_REQUESTED", entityType: "SUPPORT_CASE", entityId: caseId, idempotencyKey: `resolution-mediation:${caseId}:${supportCase.version}`, recipients: admins.map(({ id }) => ({ userId: id, title: "Resolution mediation requested", message: `A participant requested mediation for ${supportCase.caseNumber}.`, link: `/admin/support/${encodeURIComponent(caseId)}` })) });
    return supportCase;
  });
  await deliverCommittedResolutionNotifications();
  return updated;
}

async function linkResolutionOfferRefund(actor: AuthUser, offerId: string, refundId: string) {
  if (actor.role !== Role.ADMIN) throw AppError.forbidden("Only an administrator can link an authorized refund request.");
  return prisma.$transaction(async (tx) => {
    const offer = await tx.resolutionOffer.findUnique({ where: { id: offerId } });
    if (!offer) throw AppError.notFound("Resolution offer not found.");
    if (offer.status !== ResolutionOfferStatus.ACCEPTED || offer.amount === null) throw AppError.conflict("Only accepted monetary offers can be linked to a refund request.");
    const refund = await tx.bookingRefund.findUnique({ where: { id: refundId } });
    if (!refund || refund.bookingId !== offer.bookingId) throw AppError.badRequest("The refund request must belong to this offer's booking.");
    if (refund.resolutionOfferId && refund.resolutionOfferId !== offer.id) throw AppError.conflict("This refund request is already linked to another resolution offer.");
    const updated = await tx.bookingRefund.update({ where: { id: refundId }, data: { resolutionOfferId: offer.id, supportCaseId: offer.caseId } });
    await tx.supportCaseEvent.create({ data: { caseId: offer.caseId, actorId: actor.id, eventType: "RESOLUTION_REFUND_LINKED", visibility: SupportCaseContentVisibility.ADMINS_ONLY, description: "An authorized refund request was linked to an accepted resolution offer." } });
    return updated;
  });
}

async function createResolutionRequest(actor: AuthUser, input: CreateOfferInput & { bookingId: string; subject: string; category?: string; issueType?: string }) {
  const subject = cleanText(input.subject, "Subject", 160);
  const values = offerValues(input);
  if (!input.bookingId) throw AppError.badRequest("A booking is required for a resolution request.");
  if (input.idempotencyKey) {
    const existing = await prisma.resolutionOffer.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.proposerId !== actor.id) throw AppError.conflict("This resolution request key is already in use.");
      return { supportCaseId: existing.caseId, offer: existing };
    }
  }
  const result = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: input.bookingId }, select: { id: true, userId: true, listingId: true, currency: true, listing: { select: { hostId: true } } } });
    if (!booking) throw AppError.notFound("Booking not found.");
    const guest = booking.userId === actor.id;
    const host = booking.listing.hostId === actor.id;
    if (!guest && !host) throw AppError.forbidden("Only this booking's guest or host can create a resolution request.");
    const recipientId = guest ? booking.listing.hostId : booking.userId;
    const now = new Date();
    const sla = getSupportSlaDeadlines(SupportCasePriority.MEDIUM, now);
    const supportCase = await tx.supportCase.create({ data: { caseNumber: `SC-${nanoid(10).toUpperCase()}`, idempotencyKey: `resolution-case:${input.idempotencyKey || nanoid(18)}`, reporterId: actor.id, reporterRole: guest ? SupportCaseParticipantRole.GUEST : SupportCaseParticipantRole.HOST, bookingId: booking.id, listingId: booking.listingId, category: input.category?.trim().toUpperCase() || "BOOKING", issueType: input.issueType?.trim().toUpperCase() || "PROPERTY_ISSUE", subject, description: values.description, priority: SupportCasePriority.MEDIUM, slaDueAt: sla.slaDueAt, firstResponseDueAt: sla.firstResponseDueAt, nextResponseDueAt: sla.nextResponseDueAt, slaPolicyVersion: sla.policyVersion, participants: { create: [{ userId: actor.id, role: SupportCaseParticipantRole.REPORTER }, { userId: recipientId, role: guest ? SupportCaseParticipantRole.HOST : SupportCaseParticipantRole.GUEST }] }, events: { create: [{ actorId: actor.id, eventType: "CASE_CREATED", visibility: SupportCaseContentVisibility.PARTICIPANTS, description: "Resolution request created." }, { actorId: actor.id, eventType: "RESOLUTION_REQUESTED", visibility: SupportCaseContentVisibility.PARTICIPANTS, description: "A direct booking resolution was requested." }] } } });
    const offer = await tx.resolutionOffer.create({ data: { caseId: supportCase.id, bookingId: booking.id, proposerId: actor.id, recipientId, offerType: input.offerType, amount: values.amount, currency: input.currency?.toUpperCase() || booking.currency || "SAR", description: values.description, expiresAt: input.expiresAt || null, idempotencyKey: input.idempotencyKey } });
    await tx.auditLog.create({ data: { actorId: actor.id, actorEmail: actor.email, action: "RESOLUTION_REQUEST_CREATED", resourceType: "SUPPORT_CASE", resourceId: supportCase.id, description: "Direct booking resolution request created.", status: "SUCCESS", metadata: { resolutionOfferId: offer.id, bookingId: booking.id } } });
    await enqueueSupportNotification(tx, { eventType: "RESOLUTION_REQUESTED", entityType: "SUPPORT_CASE", entityId: supportCase.id, idempotencyKey: `resolution-request:${supportCase.id}`, recipients: [{ userId: recipientId, title: "New booking resolution request", message: "A booking participant requested a direct resolution.", link: await resolutionCaseLink(tx, recipientId, supportCase.id) }] });
    const admins = await resolutionReviewers(tx, actor.id);
    await enqueueSupportNotification(tx, { eventType: "RESOLUTION_REQUESTED_FOR_REVIEW", entityType: "SUPPORT_CASE", entityId: supportCase.id, idempotencyKey: `resolution-request:queue:${supportCase.id}`, recipients: admins.map(({ id }) => ({ userId: id, title: "New direct resolution request", message: `A booking resolution request ${supportCase.caseNumber} was created.`, link: `/admin/support/${encodeURIComponent(supportCase.id)}` })) });
    return { supportCase, offer };
  });
  await deliverCommittedResolutionNotifications();
  return { supportCaseId: result.supportCase.id, offer: result.offer };
}

export const resolutionOfferService = { createResolutionRequest, createResolutionOffer, actOnResolutionOffer, requestResolutionMediation, linkResolutionOfferRefund };
