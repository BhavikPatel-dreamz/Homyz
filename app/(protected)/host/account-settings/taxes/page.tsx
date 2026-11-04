import React from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { hostTaxService } from "@/services/host-tax.service";
import {
  SettingsPageHeader,
  HostSettingsNavigation,
  SettingsHelpCard,
  TaxpayerManager,
  TaxDocumentsManager,
  ReceiptTaxIcon,
  FileTextIcon,
} from "@/components/host/account-settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface TaxInformationPageProps {
  searchParams?: Promise<{ tab?: string }>;
}

export default async function TaxInformationPage({ searchParams }: TaxInformationPageProps) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const currentTab = resolvedSearchParams.tab === "documents" ? "documents" : "taxpayers";

  const [profile, vatRegistrations, documents] = await Promise.all([
    hostTaxService.getHostTaxpayerProfile(actor),
    hostTaxService.getHostVatRegistrations(actor),
    hostTaxService.getHostTaxDocuments(actor),
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
            title="Tax Information"
            subtitle="Manage your legal taxpayer entity, Saudi ZATCA VAT registration, and download annual tax reporting documents."
            breadcrumbs={[{ label: "Tax Information" }]}
            badge={isVerified ? "Tax Status Verified" : profile ? "Profile Submitted" : "Setup Required"}
            badgeVariant={isVerified ? "success" : profile ? "warning" : "info"}
          />

          {/* Airbnb-style Tab Controls */}
          <div className="mb-8 flex items-center border-b border-zinc-200">
            <Link
              href="/host/account-settings/taxes?tab=taxpayers"
              className={`inline-flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
                currentTab === "taxpayers"
                  ? "border-zinc-950 text-zinc-950 font-medium"
                  : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800"
              }`}
            >
              <ReceiptTaxIcon size={18} />
              <span>Taxpayers</span>
              {profile && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                  1
                </span>
              )}
            </Link>

            <Link
              href="/host/account-settings/taxes?tab=documents"
              className={`inline-flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
                currentTab === "documents"
                  ? "border-zinc-950 text-zinc-950 font-medium"
                  : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800"
              }`}
            >
              <FileTextIcon size={18} />
              <span>Tax Documents</span>
              {documents.length > 0 && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                  {documents.length}
                </span>
              )}
            </Link>
          </div>

          {/* Tab Content */}
          {currentTab === "taxpayers" ? (
            <TaxpayerManager
              hostId={actor.id}
              initialProfile={profile}
              initialVatRegistrations={vatRegistrations}
            />
          ) : (
            <TaxDocumentsManager
              hostId={actor.id}
              initialDocuments={documents}
            />
          )}

          {/* Help Card */}
          <div className="mt-10">
            <SettingsHelpCard
              title="Understanding Host Tax Requirements in Saudi Arabia"
              description="Hosts operating as commercial businesses or exceeding the ZATCA mandatory VAT threshold (375,000 SAR annual revenue) are required to collect and remit 15% VAT. Platform-managed tourist occupancy taxes are remitted automatically by Homyz on behalf of eligible properties."
              links={[
                { label: "Taxpayer Guidelines", href: "/host/account-settings/taxes?tab=taxpayers" },
                { label: "Annual Documents", href: "/host/account-settings/taxes?tab=documents" },
                { label: "Earnings Reports Hub", href: "/host/earnings/reports" },
              ]}
            />
          </div>
        </section>
      </div>
    </Container>
  );
}
