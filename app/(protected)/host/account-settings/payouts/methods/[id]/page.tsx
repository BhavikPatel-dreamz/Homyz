import React from "react";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { payoutService, type HostPayoutMethod } from "@/services/payout.service";
import {
  SettingsPageHeader,
  HostSettingsNavigation,
  SettingsHelpCard,
  BuildingBankIcon,
} from "@/components/host/account-settings";
import { PayoutMethodDetailClient } from "@/components/host/account-settings/payout-method-detail-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PayoutMethodDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const { id } = await params;

  let method: HostPayoutMethod;
  try {
    method = await payoutService.getHostPayoutMethodById(actor.id, id);
  } catch (error) {
    console.error("Failed to load payout method:", error);
    notFound();
  }

  return (
    <Container className="max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-4 lg:gap-8">
        <aside className="lg:col-span-1">
          <HostSettingsNavigation className="sticky top-24" />
        </aside>

        <section className="min-w-0 lg:col-span-3">
          <SettingsPageHeader
            title={method.bankName}
            subtitle="Account details, permitted edits, and verification status for this payout destination."
            backHref="/host/account-settings/payouts"
            backLabel="Back to Payout Settings"
            breadcrumbs={[
              { label: "Payout Settings", href: "/host/account-settings/payouts" },
              { label: method.bankName },
            ]}
          />

          <PayoutMethodDetailClient initialMethod={method} />

          <div className="mt-8">
            <SettingsHelpCard
              title="Updating Account Details"
              description="Under SAMA financial compliance regulations, bank account numbers cannot be directly edited. To update your banking institution or account number, add a new payout method and designate it as your default."
              icon={<BuildingBankIcon size={20} />}
            />
          </div>
        </section>
      </div>
    </Container>
  );
}
