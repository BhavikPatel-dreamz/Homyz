import React from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import {
  SettingsSectionCard,
  SettingsHelpCard,
  CreditCardIcon,
  ReceiptTaxIcon,
  BarChartReportsIcon,
  ExternalLinkIcon,
} from "@/components/host/account-settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HostAccountSettingsPage() {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);

  return (
    <Container className="max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      {/* Top Banner / Welcome Row */}
      <div className="mb-8 flex flex-col gap-4 border-b border-zinc-200/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#1F1F1F] sm:text-3xl">
              Host Account Settings
            </h1>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
              {actor.role === Role.ADMIN ? "Admin (Hosting Mode)" : "Host"}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-[#727272] sm:text-base max-w-2xl">
            Manage your payout methods, taxpayer information, Saudi VAT documents, and earnings reports.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/host/earnings"
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-zinc-800 shadow-2xs hover:bg-zinc-50 transition-colors"
          >
            <span>View Earnings Hub</span>
            <ExternalLinkIcon size={14} className="text-zinc-500" />
          </Link>
        </div>
      </div>

      {/* Main 3 Section Cards Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {/* 1. Payout Settings */}
        <SettingsSectionCard
          title="Payout Settings"
          description="Manage payout methods, bank accounts, and payout routing rules."
          href="/host/account-settings/payouts"
          icon={<CreditCardIcon size={24} className="text-zinc-900" />}
          badge="How You Get Paid"
          badgeVariant="success"
          footerNote="Bank accounts & payout routing"
          actionLabel="View settings"
        />

        {/* 2. Tax Information */}
        <SettingsSectionCard
          title="Tax Information"
          description="Manage taxpayer profiles, Saudi VAT registration, and tax documents."
          href="/host/account-settings/taxes"
          icon={<ReceiptTaxIcon size={24} className="text-zinc-900" />}
          badge="ZATCA Taxpayers"
          badgeVariant="info"
          footerNote="Taxpayers & Saudi VAT documents"
          actionLabel="View settings"
        />

        {/* 3. Earnings Reports & Documents */}
        <SettingsSectionCard
          title="Earnings Reports & Documents"
          description="View monthly and annual earnings statements and download financial reports."
          href="/host/account-settings/earnings-reports"
          icon={<BarChartReportsIcon size={24} className="text-zinc-900" />}
          badge="Financial Ledger"
          badgeVariant="neutral"
          footerNote="Monthly & annual statements"
          actionLabel="View reports"
        />

      </div>

      {/* Helpful Guidance Footer Card */}
      <div className="mt-10">
        <SettingsHelpCard
          title="Looking for property listing settings or guest profile settings?"
          description="Host Account Settings manages your account-wide financial, tax, and hosting policies. To adjust listing pricing, house rules, or property-level taxes, navigate to Your Listings. To update personal identity or guest profile details, switch to Traveling mode."
          links={[
            { label: "Go to Your Listings", href: "/host/listings" },
            { label: "Switch to Traveling Profile", href: "/profile" },
            { label: "Visit Host Help & Resolution Center", href: "/host/support" },
          ]}
        />
      </div>
    </Container>
  );
}
