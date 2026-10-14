import { Role, NotificationType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { deletePrivateMedia } from "@/lib/storage/media";
import { disputeService } from "@/services/dispute.service";
import { notificationService } from "@/services/notification.service";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const booking = await prisma.booking.findFirst({
    where: { listing: { host: { role: Role.HOST } }, user: { role: Role.USER } },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, role: true, email: true, name: true } },
      listing: { include: { host: { select: { id: true, role: true, email: true, name: true } } } },
    },
  });
  const admin = await prisma.user.findFirst({
    where: { role: Role.ADMIN, email: { not: null } },
    select: { id: true, role: true, email: true, name: true },
  });
  assert(booking && booking.user.email && booking.listing.host.email && admin?.email, "A guest booking, host, and admin with emails are required.");

  const guestActor = { id: booking.user.id, role: booking.user.role, email: booking.user.email, name: booking.user.name };
  const hostActor = { id: booking.listing.host.id, role: booking.listing.host.role, email: booking.listing.host.email, name: booking.listing.host.name };
  const adminActor = { id: admin.id, role: admin.role, email: admin.email, name: admin.name };
  let disputeId: string | undefined;

  try {
    const created = await disputeService.createDispute(guestActor, {
      bookingId: booking.id,
      category: "OTHER",
      severity: "LOW",
      description: "Temporary automated verification case. It will be removed after the test.",
    });
    const caseId = created.id;
    disputeId = caseId;
    const adminCreationNotification = await prisma.notification.findFirst({
      where: { userId: adminActor.id, entityId: caseId, entityType: "dispute-case-created-admin" },
    });
    assert(adminCreationNotification?.link === `/admin/bookings/disputes/${caseId}`, "Admin new-case notification link is incorrect.");

    const request = await disputeService.requestDisputeInfo(
      adminActor,
      caseId,
      "HOST",
      "Please provide a brief verification response and a PDF attachment.",
    );
    const responseNotification = await prisma.notification.findFirst({
      where: { userId: hostActor.id, entityId: caseId, entityType: `dispute-host-response-required-${request.id}` },
    });
    assert(responseNotification?.link === `/host/resolution-center/${caseId}`, "Host response notification link is incorrect.");

    const historic = await prisma.notification.create({
      data: {
        userId: hostActor.id,
        type: NotificationType.BOOKING,
        title: "Historical dispute notification",
        message: "Temporary link repair verification.",
        entityId: caseId,
        entityType: "dispute-historical-verification",
        link: "/profile/tab/notifications",
        metadata: { disputeId: caseId },
      },
    });
    const repaired = await notificationService.listForUser(hostActor.id, { take: 50 });
    assert(repaired.items.find((item: { id: string; link: string | null }) => item.id === historic.id)?.link === `/host/resolution-center/${caseId}`, "Historical host notification was not repaired.");

    const caseList = await disputeService.listDisputesForHost(hostActor, { tab: "response_required", limit: 20 });
    assert(caseList.disputes.some((item: { id: string; responseRequired: boolean }) => item.id === caseId && item.responseRequired), "Host response-required case is absent from the list.");

    const submitted = await disputeService.submitHostDisputeResponse(hostActor, caseId, {
      content: "Temporary host response for automated verification.",
      evidenceFiles: [{ fileName: "verification.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nverification\n%%EOF") }],
    });
    assert(submitted.evidence.length === 1, "Evidence was not recorded.");

    const hostDetails = await disputeService.getDisputeDetailsForHost(hostActor, caseId);
    assert(!hostDetails.dispute.responseRequired, "Host response-required state did not clear.");
    assert(hostDetails.dispute.evidence.length === 1, "Host cannot see its submitted evidence.");
    const servedEvidence = await disputeService.getDisputeEvidenceForParticipant(hostActor, caseId, hostDetails.dispute.evidence[0].id);
    assert(servedEvidence.buffer.toString("ascii", 0, 5) === "%PDF-", "Evidence cannot be read through the authorized route.");

    const adminDetails = await disputeService.getDisputeDetailsForAdmin(adminActor, caseId);
    assert(adminDetails.dispute.partyResponses.length === 1, "Admin cannot see the host response.");
    const adminEvidence = await disputeService.getDisputeEvidenceForParticipant(adminActor, caseId, hostDetails.dispute.evidence[0].id);
    assert(adminEvidence.buffer.toString("ascii", 0, 5) === "%PDF-", "Admin cannot access submitted evidence.");

    const reply = await disputeService.sendHostDisputeReply(hostActor, caseId, {
      content: "Temporary host-to-support reply for automated verification.",
    });
    assert(reply.reply.audience === "ADMIN_ONLY", "Host reply is not restricted to Homyz Support.");
    const detailsAfterReply = await disputeService.getDisputeDetailsForHost(hostActor, caseId);
    assert(detailsAfterReply.dispute.replies.some((item: { id: string }) => item.id === reply.reply.id), "Host reply did not persist in the host conversation.");
    const adminAfterReply = await disputeService.getDisputeDetailsForAdmin(adminActor, caseId);
    assert(adminAfterReply.dispute.partyResponses.some((item: { id: string }) => item.id === reply.reply.id), "Admin cannot see the official host reply.");

    const note = await disputeService.addHostDisputePrivateNote(hostActor, caseId, "Temporary private host note.");
    const updatedNote = await disputeService.updateHostDisputePrivateNote(hostActor, caseId, note.id, "Temporary updated private host note.");
    const hostAfterNote = await disputeService.getDisputeDetailsForHost(hostActor, caseId);
    assert(hostAfterNote.dispute.privateNotes.some((item: { id: string; content: string }) => item.id === updatedNote.id && item.content === updatedNote.content), "Host private note did not persist.");
    const adminAfterNote = await disputeService.getDisputeDetailsForAdmin(adminActor, caseId);
    assert(!Object.hasOwn(adminAfterNote.dispute, "hostPrivateNotes"), "Host private notes leaked into the admin DTO.");
    await disputeService.deleteHostDisputePrivateNote(hostActor, caseId, note.id);
    const hostAfterNoteDelete = await disputeService.getDisputeDetailsForHost(hostActor, caseId);
    assert(!hostAfterNoteDelete.dispute.privateNotes.some((item: { id: string }) => item.id === note.id), "Host private note was not deleted.");

    await disputeService.resolveDispute(adminActor, caseId, {
      decisionCategory: "RESOLVED_NO_FINANCIAL_ADJUSTMENT",
      explanation: "Temporary automated verification resolution.",
    });
    const resolutionNotification = await prisma.notification.findFirst({
      where: { userId: hostActor.id, entityId: caseId, entityType: "dispute-resolution-host" },
    });
    assert(resolutionNotification?.link === `/host/resolution-center/${caseId}`, "Host resolution notification link is incorrect.");

    const otherHost = await prisma.user.findFirst({ where: { role: Role.HOST, id: { not: hostActor.id }, email: { not: null } }, select: { id: true, role: true, email: true } });
    if (otherHost?.email) {
      await disputeService.getDisputeDetailsForHost(otherHost, caseId)
        .then(() => { throw new Error("An unrelated host could read the case."); })
        .catch((error) => assert(error?.status === 404 || error?.statusCode === 404, "Unrelated host did not receive a not-found response."));
      await disputeService.addHostDisputePrivateNote(otherHost, caseId, "Unauthorized note")
        .then(() => { throw new Error("An unrelated host could add a private note."); })
        .catch((error) => assert(error?.status === 404 || error?.statusCode === 404, "Unrelated host did not receive a not-found response for notes."));
    }

    console.log("Host dispute workflow verification passed.");
  } finally {
    if (disputeId) {
      const record = await prisma.listingQualityIncident.findUnique({ where: { id: disputeId }, select: { metadata: true } });
      const evidence = ((record?.metadata as Record<string, any> | null)?.evidence || []) as Array<{ storagePath?: string }>;
      await prisma.notification.deleteMany({ where: { entityId: disputeId } });
      await prisma.listingQualityIncident.delete({ where: { id: disputeId } }).catch(() => undefined);
      await Promise.all(evidence.filter((item) => item.storagePath).map((item) => deletePrivateMedia({ kind: "dispute-evidence", fileName: item.storagePath! }).catch(() => undefined)));
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
