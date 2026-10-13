import React from "react";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { paymentAdminService } from "@/services/payment-admin.service";
import { AdminPaymentDetailsClient } from "./admin-payment-details-client";

export const dynamic = "force-dynamic";

export default async function AdminPaymentDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePageRole([Role.ADMIN]);
  const { id } = await params;

  let details = null;
  try {
    details = await paymentAdminService.getPaymentDetailsForAdmin(actor, id);
  } catch (err: any) {
    notFound();
  }

  return <AdminPaymentDetailsClient initialData={details} />;
}

