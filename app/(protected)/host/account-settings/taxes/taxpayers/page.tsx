import React from "react";
import { Container } from "@/components/ui/container";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { hostTaxService } from "@/services/host-tax.service";
import {
  SettingsPageHeader,
  HostSettingsNavigation,
  SettingsHelpCard,
  TaxpayerManager,
} from "@/components/host/account-settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TaxpayersPage() {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);

  const [profile, vatRegistrations] = await Promise.all([
    hostTaxService.getHostTaxpayerProfile(actor),
    hostTaxService.getHostVatRegistrations(actor),
  ]);

  const activeVat = vatRegistrations.find((r) => r.taxType === "VAT_ID" || r.taxType === "VAT");
  const isVerified = profile?.status === "VERIFIED" || activeVat?.status === "VERIFIED";

  return (
    <Container className="max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-4 lg:gap-8">
        <aside className="lg:col-span-1">
          <HostSettingsNavigation className="sticky top-24" />
        </aside>

        <section className="min-w-0 lg:col-span-3">
          <SettingsPageHeader
            title="Taxpayer Information"
            subtitle="Manage your legal entity, Saudi National ID/Iqama/CR numbers, and ZATCA VAT registration details."
            backHref="/host/account-settings/taxes"
            backLabel="Back to Tax Information"
            breadcrumbs={[
              { label: "Tax Information", href: "/host/account-settings/taxes" },
              { label: "Taxpayers" },
            ]}
            badge={isVerified ? "Verified Taxpayer" : profile ? "Under Review" : "Action Required"}
            badgeVariant={isVerified ? "success" : profile ? "warning" : "info"}
          />

          <TaxpayerManager
            hostId={actor.id}
            initialProfile={profile}
            initialVatRegistrations={vatRegistrations}
          />

          <div className="mt-8">
            <SettingsHelpCard
              title="Need assistance with tax certificates?"
              description="Review Saudi ZATCA guidelines for electronic invoicing and VAT registration requirements for hospitality and short-term rentals."
              links={[
                { label: "View Tax Documents", href: "/host/account-settings/taxes?tab=documents" },
                { label: "Back to Tax Hub", href: "/host/account-settings/taxes" },
              ]}
            />
          </div>
        </section>
      </div>
    </Container>
  );
}
