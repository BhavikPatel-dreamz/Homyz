import React from "react";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { disputeService } from "@/services/dispute.service";
import { AdminDisputeDetailsClient } from "./admin-dispute-details-client";

export const dynamic = "force-dynamic";

export default async function AdminDisputeDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePageRole([Role.ADMIN]);
  const { id } = await params;

  let details = null;
  try {
    details = await disputeService.getDisputeDetailsForAdmin(actor, id);
  } catch (err: any) {
    notFound();
  }

  return <AdminDisputeDetailsClient initialData={details} />;
}

