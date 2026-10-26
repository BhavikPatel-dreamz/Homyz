import React from "react";
import { Container } from "@/components/ui/container";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import {
  SettingsPageHeader,
  HostSettingsNavigation,
  SettingsHelpCard,
  BuildingBankIcon,
} from "@/components/host/account-settings";
import { AddPayoutMethodWizard } from "@/components/host/account-settings/add-payout-method-wizard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AddPayoutMethodPage() {
  await requirePageRole([Role.HOST, Role.ADMIN]);

  return (
    <Container className="max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-4 lg:gap-8">
        <aside className="lg:col-span-1">
          <HostSettingsNavigation className="sticky top-24" />
        </aside>

        <section className="min-w-0 lg:col-span-3">
          <SettingsPageHeader
            title="Add Payout Method"
            subtitle="Connect a Saudi commercial bank account to receive reservation earnings in SAR via SAMA SARIE."
            backHref="/host/account-settings/payouts"
            backLabel="Back to Payout Settings"
            breadcrumbs={[
              { label: "Payout Settings", href: "/host/account-settings/payouts" },
              { label: "Add Method" },
            ]}
            badge="SAMA SARIE"
            badgeVariant="neutral"
          />

          {/* 5-Step Wizard */}
          <AddPayoutMethodWizard />

          <div className="mt-8">
            <SettingsHelpCard
              title="Supported Saudi Financial Institutions"
              description="Al Rajhi Bank, Saudi National Bank (SNB), Riyad Bank, Alinma Bank, Banque Saudi Fransi, SAB (Saudi Awwal Bank), Bank AlJazira, Saudi Investment Bank, Bank AlBilad, Arab National Bank, Gulf International Bank, Emirates NBD KSA."
              icon={<BuildingBankIcon size={20} />}
            />
          </div>
        </section>
      </div>
    </Container>
  );
}
