import React from "react";
import { Container } from "@/components/ui/container";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { hostTaxService } from "@/services/host-tax.service";
import {
  SettingsPageHeader,
  HostSettingsNavigation,
  SettingsHelpCard,
  TaxDocumentsManager,
} from "@/components/host/account-settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TaxDocumentsPage() {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);

  const documents = await hostTaxService.getHostTaxDocuments(actor);

  return (
    <Container className="max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-4 lg:gap-8">
        <aside className="lg:col-span-1">
          <HostSettingsNavigation className="sticky top-24" />
        </aside>

        <section className="min-w-0 lg:col-span-3">
          <SettingsPageHeader
            title="Tax Documents"
            subtitle="Download annual earnings summaries, VAT reports, and reservation tax invoices for accounting."
            backHref="/host/account-settings/taxes"
            backLabel="Back to Tax Information"
            breadcrumbs={[
              { label: "Tax Information", href: "/host/account-settings/taxes" },
              { label: "Tax Documents" },
            ]}
            badge={documents.length > 0 ? `${documents.length} Available` : "No Documents"}
            badgeVariant={documents.length > 0 ? "info" : "neutral"}
          />

          <TaxDocumentsManager
            hostId={actor.id}
            initialDocuments={documents}
          />

          <div className="mt-8">
            <SettingsHelpCard
              title="Official Tax Reporting"
              description="Homyz provides annual gross summary reports and booking tax breakdown invoices. For detailed transaction spreadsheets and monthly reports, visit the Earnings Reports Hub."
              links={[
                { label: "Earnings Reports Hub", href: "/host/earnings/reports" },
                { label: "Taxpayer Information", href: "/host/account-settings/taxes?tab=taxpayers" },
              ]}
            />
          </div>
        </section>
      </div>
    </Container>
  );
}
