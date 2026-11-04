import React from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import {
  SettingsPageHeader,
  HostSettingsNavigation,
  SettingsHelpCard,
  PermissionsShieldIcon,
  CheckCircleIcon,
  ExternalLinkIcon,
} from "@/components/host/account-settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FinancialPermissionsPage() {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);

  return (
    <Container className="max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-4 lg:gap-8">
        <aside className="lg:col-span-1">
          <HostSettingsNavigation className="sticky top-24" />
        </aside>

        <section className="min-w-0 lg:col-span-3">
          <SettingsPageHeader
            title="Financial Permissions"
            subtitle="Manage financial role assignments, co-host revenue visibility, and administrative access controls."
            breadcrumbs={[{ label: "Financial Permissions" }]}
            badge="Phase 7 Scheduled"
            badgeVariant="roadmapped"
          />

          <div className="rounded-3xl border border-zinc-200/90 bg-white p-6 sm:p-8 shadow-xs">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-900 border border-indigo-200">
                <PermissionsShieldIcon size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-medium text-zinc-950">
                  Role-Based Financial Access & Delegation
                </h2>
                <p className="mt-1 text-sm text-zinc-600 leading-relaxed">
                  Financial permissions control who has authorization to inspect reservation revenue, export tax invoices, and configure banking settlement destinations.
                </p>

                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900 text-sm">
                        Primary Host Account Role
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                        {actor.role}
                      </span>
                    </div>
                    <p className="mt-1 text-xs sm:text-sm text-zinc-600">
                      You possess full primary authorization to view earnings statements (`earnings.view`) and configure bank payout accounts (`earnings.payout`).
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                    <h3 className="text-sm font-medium text-zinc-900">
                      Co-Host Financial Permission Delegation
                    </h3>
                    <p className="mt-1 text-xs sm:text-sm text-zinc-600">
                      Delegate specific financial capabilities to accepted listing co-hosts. Choose whether co-hosts can inspect net revenue or if their access is restricted strictly to operational tasks and messaging.
                    </p>
                  </div>
                </div>

                <div className="mt-8 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-indigo-950">
                        Scheduled for Phase 7 Implementation
                      </p>
                      <p className="mt-0.5 text-xs text-indigo-800">
                        Granular co-host permission delegation toggles are locked for Phase 7. Current listing access invitations can be reviewed and managed in the Co-Host Hub.
                      </p>
                    </div>
                    <Link
                      href="/host/co-host"
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-zinc-950 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 transition-colors shrink-0"
                    >
                      <span>Manage Co-Hosts</span>
                      <ExternalLinkIcon size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <SettingsHelpCard
              title="Security & Audit Governance"
              description="All modifications to financial permissions, banking details, and payout methods are recorded with immutable timestamps and IP origins in the platform AuditLog."
              links={[
                { label: "Go to Co-Host Hub", href: "/host/co-host" },
                { label: "Review Payout Settings", href: "/host/account-settings/payouts" },
              ]}
            />
          </div>
        </section>
      </div>
    </Container>
  );
}

