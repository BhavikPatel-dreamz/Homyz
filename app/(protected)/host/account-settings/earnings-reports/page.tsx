import React from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { hostReportingService } from "@/services/host-reporting.service";
import {
  SettingsPageHeader,
  HostSettingsNavigation,
  SettingsHelpCard,
  EarningsReportsManager,
  ExternalLinkIcon,
} from "@/components/host/account-settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface EarningsReportsSettingsPageProps {
  searchParams?: Promise<{
    year?: string;
    propertyId?: string;
    listingId?: string;
    currency?: string;
  }>;
}

export default async function EarningsReportsSettingsPage({
  searchParams,
}: EarningsReportsSettingsPageProps) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const yearNum = resolvedSearchParams.year
    ? parseInt(resolvedSearchParams.year, 10)
    : undefined;
  const listingId = resolvedSearchParams.propertyId || resolvedSearchParams.listingId;
  const currency = resolvedSearchParams.currency;

  const initialData = await hostReportingService.getReportsLanding(actor.id, {
    year: !isNaN(Number(yearNum)) ? yearNum : undefined,
    listingId: listingId || undefined,
    currency: currency || undefined,
  });

  return (
    <Container className="max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-4 lg:gap-8">
        {/* Left Navigation Sidebar */}
        <aside className="lg:col-span-1">
          <HostSettingsNavigation className="sticky top-24" />
        </aside>

        {/* Main Content Area */}
        <section className="min-w-0 lg:col-span-3">
          <SettingsPageHeader
            title="Earnings Reports & Documents"
            subtitle="Access authoritative monthly statements, yearly accounting summaries, and downloadable PDF/CSV reports."
            breadcrumbs={[{ label: "Earnings Reports" }]}
            badge="Authoritative Engine"
            badgeVariant="success"
            actions={
              <Link
                href="/host/earnings/reports"
                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-zinc-800 transition-colors shadow-xs"
              >
                <span>Full Reports Hub</span>
                <ExternalLinkIcon size={14} />
              </Link>
            }
          />

          {/* Interactive Reports & Statements Manager */}
          <EarningsReportsManager initialData={initialData} hostId={actor.id} />

          {/* Help & Compliance Card */}
          <div className="mt-8">
            <SettingsHelpCard
              title="Report Format & Accounting Retention Policy"
              description="Financial statements are computed directly from finalized booking settlement ledgers. Figures reconcile down to the halala/cent. Reports remain available indefinitely in your host archive and are suitable for ZATCA VAT auditing and personal tax filings."
              links={[
                { label: "Inspect Full Transaction Ledger", href: "/host/earnings/transactions" },
                { label: "Review Tax Information & Invoices", href: "/host/account-settings/taxes" },
                { label: "Manage Payout Methods & Routing", href: "/host/account-settings/payouts" },
              ]}
            />
          </div>
        </section>
      </div>
    </Container>
  );
}
