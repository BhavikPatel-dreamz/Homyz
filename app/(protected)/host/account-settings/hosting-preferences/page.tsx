import React from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import {
  SettingsPageHeader,
  HostSettingsNavigation,
  SettingsHelpCard,
  PreferencesSlidersIcon,
  ExternalLinkIcon,
} from "@/components/host/account-settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HostingPreferencesPage() {
  await requirePageRole([Role.HOST, Role.ADMIN]);

  return (
    <Container className="max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-4 lg:gap-8">
        <aside className="lg:col-span-1">
          <HostSettingsNavigation className="sticky top-24" />
        </aside>

        <section className="min-w-0 lg:col-span-3">
          <SettingsPageHeader
            title="Hosting Preferences"
            subtitle="Configure your hosting policies, minimum payout release thresholds, and disbursement schedules."
            breadcrumbs={[{ label: "Hosting Preferences" }]}
            badge="Phase 7 Scheduled"
            badgeVariant="roadmapped"
          />

          <div className="rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-8 shadow-xs">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-900 border border-indigo-200">
                <PreferencesSlidersIcon size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-zinc-950">
                  Business Rules & Financial Policies
                </h2>
                <p className="mt-1 text-sm text-zinc-600 leading-relaxed">
                  Customize the financial and operational parameters that govern your hosting operations across all properties.
                </p>

                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                    <h3 className="text-sm font-semibold text-zinc-900">
                      Minimum Payout Release Threshold
                    </h3>
                    <p className="mt-1 text-xs sm:text-sm text-zinc-600">
                      Specify a minimum accumulated balance (e.g. 500 SAR) before Homyz triggers a bank disbursement to your account. Currently, payouts disburse automatically 24 hours after check-in.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                    <h3 className="text-sm font-semibold text-zinc-900">
                      Payout Cadence & Frequency
                    </h3>
                    <p className="mt-1 text-xs sm:text-sm text-zinc-600">
                      Choose whether eligible settlements are processed daily as reservations complete, or batched into weekly or monthly corporate banking SARIE transfers.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                    <h3 className="text-sm font-semibold text-zinc-900">
                      Standard Turnover & Checkout Rules
                    </h3>
                    <p className="mt-1 text-xs sm:text-sm text-zinc-600">
                      Account-wide defaults for standard check-in/out times, advance notice, and turnover buffer blocks.
                    </p>
                  </div>
                </div>

                <div className="mt-8 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-indigo-950">
                        Scheduled for Phase 7 Implementation
                      </p>
                      <p className="mt-0.5 text-xs text-indigo-800">
                        The `HostFinancialPreference` data model and configuration controls are locked for Phase 7. Current property-level availability and blackout settings can be managed directly on your Calendar.
                      </p>
                    </div>
                    <Link
                      href="/host/calendar"
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors shrink-0"
                    >
                      <span>Open Calendar</span>
                      <ExternalLinkIcon size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <SettingsHelpCard
              title="Listing-Level Availability Settings"
              description="To modify booking preparation times, minimum nights, or custom seasonal pricing for a specific property, visit your Listing Calendar."
              links={[
                { label: "Go to Calendar", href: "/host/calendar" },
                { label: "View Payout Settings", href: "/host/account-settings/payouts" },
              ]}
            />
          </div>
        </section>
      </div>
    </Container>
  );
}

