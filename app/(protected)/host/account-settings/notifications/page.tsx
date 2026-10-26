import React from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import {
  SettingsPageHeader,
  HostSettingsNavigation,
  SettingsHelpCard,
  NotificationsBellIcon,
  HelpCircleIcon,
  ExternalLinkIcon,
} from "@/components/host/account-settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NotificationsHelpPage() {
  await requirePageRole([Role.HOST, Role.ADMIN]);

  return (
    <Container className="max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-4 lg:gap-8">
        <aside className="lg:col-span-1">
          <HostSettingsNavigation className="sticky top-24" />
        </aside>

        <section className="min-w-0 lg:col-span-3">
          <SettingsPageHeader
            title="Notifications & Help"
            subtitle="Configure payout alert preferences, delivery channels, and access hosting financial support."
            breadcrumbs={[{ label: "Notifications & Help" }]}
            badge="Phase 7 Scheduled"
            badgeVariant="roadmapped"
          />

          <div className="rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-8 shadow-xs">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-900 border border-indigo-200">
                <NotificationsBellIcon size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-zinc-950">
                  Payout Alerts & Communication Channels
                </h2>
                <p className="mt-1 text-sm text-zinc-600 leading-relaxed">
                  Choose how and when Homyz notifies you regarding earnings milestones, bank settlement confirmations, and regulatory notices.
                </p>

                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                    <h3 className="text-sm font-semibold text-zinc-900">
                      Disbursement Confirmations
                    </h3>
                    <p className="mt-1 text-xs sm:text-sm text-zinc-600">
                      Instant notifications dispatched to your email and in-app inbox whenever a reservation payout passes the 24-hour check-in mark and settles.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                    <h3 className="text-sm font-semibold text-zinc-900">
                      Administrative Hold & Dispute Alerts
                    </h3>
                    <p className="mt-1 text-xs sm:text-sm text-zinc-600">
                      High-priority alerts sent immediately if a reservation payout is held due to a guest dispute or pending account verification.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                    <h3 className="text-sm font-semibold text-zinc-900">
                      Annual Tax Document Ready
                    </h3>
                    <p className="mt-1 text-xs sm:text-sm text-zinc-600">
                      Annual alerts notifying you when consolidated accounting statements and ZATCA tax summaries are compiled.
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
                        Granular email and SMS notification preference toggles are locked for Phase 7. Core transactional payout notifications are active by default.
                      </p>
                    </div>
                    <Link
                      href="/host/resolution-center"
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors shrink-0"
                    >
                      <span>Resolution Center</span>
                      <ExternalLinkIcon size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <SettingsHelpCard
              title="Need Host Support or Assistance?"
              description="Our host support specialists are available 24/7 to assist with reservation disputes, quality incidents, or SAMA banking verification inquiries."
              links={[
                { label: "Host Resolution Center", href: "/host/resolution-center" },
                { label: "Earnings Hub & Transaction Details", href: "/host/earnings" },
              ]}
              icon={<HelpCircleIcon size={20} />}
            />
          </div>
        </section>
      </div>
    </Container>
  );
}

