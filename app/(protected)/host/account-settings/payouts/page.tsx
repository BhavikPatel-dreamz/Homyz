import React from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { payoutService, type HostPayoutMethod } from "@/services/payout.service";
import {
  SettingsPageHeader,
  HostSettingsNavigation,
  SettingsHelpCard,
  CreditCardIcon,
  BuildingBankIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
} from "@/components/host/account-settings";
import { PayoutMethodsManager } from "@/components/host/account-settings/payout-methods-manager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PayoutSettingsPage() {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);

  let methods: HostPayoutMethod[] = [];
  try {
    methods = await payoutService.getHostPayoutMethods(actor.id);
  } catch (error) {
    console.error("Failed to load payout methods:", error);
    methods = [];
  }

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
            title="How you get paid"
            subtitle="You can receive your hosting earnings through one or more registered bank accounts."
            breadcrumbs={[{ label: "Payout Settings" }]}
            badge={methods.length ? `${methods.length} Account${methods.length > 1 ? "s" : ""}` : undefined}
            badgeVariant="neutral"
            actions={
              <Link
                href="/host/earnings"
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-zinc-800 shadow-2xs hover:bg-zinc-50 transition-colors"
              >
                <span>Earnings Hub</span>
                <ExternalLinkIcon size={14} className="text-zinc-500" />
              </Link>
            }
          />

          {/* Quick Sub-Navigation Cards */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              href="/host/account-settings/payouts/add"
              className="group flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 transition-all hover:border-zinc-300 hover:bg-white hover:shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-900 shadow-2xs group-hover:bg-[#FCDF9C]/50 transition-colors">
                  <CreditCardIcon size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1F1F1F]">Add Payout Method</p>
                  <p className="text-xs text-zinc-500">Saudi IBAN bank accounts</p>
                </div>
              </div>
              <ChevronRightIcon size={18} className="text-zinc-400 group-hover:text-zinc-900 group-hover:translate-x-0.5 transition-all" />
            </Link>

            {/* <Link
              href="/host/account-settings/payouts/routing-rules"
              className="group flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 transition-all hover:border-zinc-300 hover:bg-white hover:shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-900 shadow-2xs group-hover:bg-[#FCDF9C]/50 transition-colors">
                  <BuildingBankIcon size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1F1F1F]">Payout Routing Rules</p>
                  <p className="text-xs text-zinc-500">Split payouts & co-host shares</p>
                </div>
              </div>
              <ChevronRightIcon size={18} className="text-zinc-400 group-hover:text-zinc-900 group-hover:translate-x-0.5 transition-all" />
            </Link> */}
          </div>

          {/* Payout Methods List or Empty State */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#1F1F1F]">
                Your Registered Accounts
              </h2>
              <span className="text-xs text-zinc-500">
                Processed via Saudi SAMA SARIE Rails
              </span>
            </div>

            <PayoutMethodsManager initialMethods={methods} />
          </div>

          {/* SAMA & Banking Notice Help Card */}
          <div className="mt-10">
            <SettingsHelpCard
              title="How You Get Paid on Homyz"
              description="Guest payments are authorized at booking time and captured upon confirmation. In accordance with platform policy, host payouts are scheduled 24 hours after guest check-in. Funds are disbursed to your verified Saudi IBAN via corporate banking SARIE transfer."
              links={[
                { label: "Go to Earnings Hub", href: "/host/earnings" },
                { label: "View Payout Routing Rules", href: "/host/account-settings/payouts/routing-rules" },
              ]}
            />
          </div>
        </section>
      </div>
    </Container>
  );
}
