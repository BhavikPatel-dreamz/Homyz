/**
 * Development-only end-to-end service verification for dispute handling.
 *
 * Usage: pnpm exec tsx -r dotenv/config scripts/verify-dispute-workflow.ts --run
 *
 * It intentionally leaves one clearly-labelled CLOSED test case in the selected
 * development database so the admin list, summaries, and history can be audited.
 */
import assert from "node:assert/strict";

import { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import type { AuthUser } from "@/lib/auth/types";
import { disputeService } from "@/services/dispute.service";

function actorFromUser(user: { id: string; role: Role; email: string | null; name: string | null }): AuthUser {
  return { id: user.id, role: user.role, email: user.email, name: user.name };
}

async function main() {
  if (!process.argv.includes("--run")) {
    throw new Error("Refusing to create a development dispute without the --run flag.");
  }

  const booking = await prisma.booking.findFirst({
    where: { user: { role: Role.USER }, listing: { host: { role: Role.HOST } } },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, role: true, email: true, name: true } },
      listing: { select: { host: { select: { id: true, role: true, email: true, name: true } } } },
    },
  });
  const admin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, email: true, name: true },
  });
  assert.ok(booking, "A USER booking with a HOST listing is required for the development test.");
  assert.ok(admin, "An ADMIN user is required for the development test.");
  assert.ok(admin.email, "The test administrator must have an email address.");

  const guest = actorFromUser(booking.user);
  const adminActor = actorFromUser(admin);
  const testMarker = `DISPUTE_WORKFLOW_TEST_${new Date().toISOString()}`;

  const initialSummary = await disputeService.getDisputeSummaryForAdmin(adminActor);
  const created = await disputeService.createDispute(guest, {
    bookingId: booking.id,
    category: "HOST_SERVICE",
    description: `${testMarker}: authorized guest submission for lifecycle verification.`,
  });

  assert.equal(created.bookingId, booking.id, "The created case must retain its booking link.");
  assert.equal(created.reportedById, guest.id, "The reporter must be persisted.");

  const createdDetails = await disputeService.getDisputeDetailsForAdmin(adminActor, created.id);
  const caseReference = createdDetails.dispute.caseReference;
  assert.equal(createdDetails.dispute.reporterRole, "GUEST");
  assert.equal(createdDetails.booking?.id, booking.id);

  const listAfterCreate = await disputeService.listDisputesForAdmin(adminActor, {
    search: caseReference,
    limit: 20,
  });
  assert.ok(listAfterCreate.disputes.some((caseItem) => caseItem.id === created.id), "Exact case-reference search must find the case.");

  await disputeService.assignDispute(adminActor, created.id, admin.id, admin.email);
  await disputeService.addInvestigationNote(adminActor, created.id, `${testMarker}: internal note.`);
  await disputeService.requestDisputeInfo(adminActor, created.id, "HOST", `${testMarker}: please confirm the stay details.`);
  await disputeService.resolveDispute(adminActor, created.id, {
    decisionCategory: "RESOLVED_NO_FINANCIAL_ADJUSTMENT",
    explanation: `${testMarker}: resolved after workflow verification.`,
  });

  const resolvedSummary = await disputeService.getDisputeSummaryForAdmin(adminActor);
  assert.equal(resolvedSummary.totalCases, initialSummary.totalCases + 1);
  assert.ok(resolvedSummary.resolvedCases >= initialSummary.resolvedCases + 1);

  await disputeService.closeDispute(adminActor, created.id, `${testMarker}: test closure.`);
  const finalDetails = await disputeService.getDisputeDetailsForAdmin(adminActor, created.id);
  const finalSummary = await disputeService.getDisputeSummaryForAdmin(adminActor);
  const closedList = await disputeService.listDisputesForAdmin(adminActor, { tab: "closed", limit: 20 });
  const databaseTotal = await prisma.listingQualityIncident.count();

  assert.equal(finalDetails.dispute.disputeWorkflowStatus, "CLOSED");
  assert.ok(finalDetails.dispute.internalNotes.some((note: { content: string }) => note.content.includes(testMarker)));
  assert.ok(finalDetails.dispute.timeline.some((event: { event: string }) => event.event === "CASE_CREATED"));
  assert.ok(finalDetails.dispute.timeline.some((event: { event: string }) => event.event === "CASE_ASSIGNED"));
  assert.ok(finalDetails.dispute.timeline.some((event: { event: string }) => event.event === "INTERNAL_NOTE_ADDED"));
  assert.ok(finalDetails.dispute.timeline.some((event: { event: string }) => event.event === "INFO_REQUESTED"));
  assert.ok(finalDetails.dispute.timeline.some((event: { event: string }) => event.event === "CASE_RESOLVED"));
  assert.ok(finalDetails.dispute.timeline.some((event: { event: string }) => event.event === "CASE_CLOSED"));
  assert.ok(closedList.disputes.some((caseItem) => caseItem.id === created.id), "Closed cases must remain in the admin list.");
  assert.equal(finalSummary.totalCases, databaseTotal, "Summary total and database total must reconcile.");

  const [creationNotification, infoRequestNotification] = await Promise.all([
    prisma.notification.findFirst({
      where: { entityId: created.id, entityType: "dispute-case-created", userId: booking.listing.host.id },
    }),
    prisma.notification.findFirst({
      where: { entityId: created.id, entityType: "dispute-info-request", userId: booking.listing.host.id },
    }),
  ]);
  assert.ok(creationNotification, "Filing a case must create the supported party notification.");
  assert.ok(infoRequestNotification, "Requesting information must create the supported party notification.");

  console.log(JSON.stringify({
    caseId: created.id,
    caseReference,
    databaseTotal,
    summary: finalSummary,
    listTotal: (await disputeService.listDisputesForAdmin(adminActor, { limit: 20 })).pagination.total,
    workflow: "created → assigned → noted → information requested → resolved → closed",
  }, null, 2));
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
