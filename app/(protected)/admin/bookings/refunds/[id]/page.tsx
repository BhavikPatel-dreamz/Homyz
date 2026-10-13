import React from "react";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { refundService } from "@/services/refund.service";
import { AdminRefundDetailsClient } from "./admin-refund-details-client";

export const dynamic = "force-dynamic";

export default async function AdminRefundDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePageRole([Role.ADMIN]);
  const { id } = await params;

  let details = null;
  try {
    details = await refundService.getRefundDetailsForAdmin(actor, id);
  } catch (err: any) {
    notFound();
  }

  return (
    <AdminRefundDetailsClient initialData={details} />
  );
}
