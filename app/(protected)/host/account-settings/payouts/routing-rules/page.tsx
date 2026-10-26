import React from "react";
import { Container } from "@/components/ui/container";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { prisma } from "@/lib/db/prisma";
import { payoutService } from "@/services/payout.service";
import { payoutRoutingService } from "@/services/payout-routing.service";
import {
  SettingsPageHeader,
  HostSettingsNavigation,
  SettingsHelpCard,
  PayoutRoutingManager,
} from "@/components/host/account-settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PayoutRoutingRulesPage() {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);

  // Fetch host's payout methods
  const methods = await payoutService.getHostPayoutMethods(actor.id);
  const defaultMethod =
    methods.find((m) => m.isDefault && m.status === "VERIFIED") ||
    methods.find((m) => m.status === "VERIFIED") ||
    null;

  // Fetch host's listings
  const listings = await prisma.listing.findMany({
    where: {
      hostId: actor.id,
    },
    select: {
      id: true,
      title: true,
      city: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch existing active routing rules
  const initialRules = await payoutRoutingService.getListingRoutingRules(actor.id);

  return (
    <Container className="max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-4 lg:gap-8">
        <aside className="lg:col-span-1">
          <HostSettingsNavigation className="sticky top-24" />
        </aside>

        <section className="min-w-0 lg:col-span-3">
          <SettingsPageHeader
            title="Payout Routing Rules"
            subtitle="Configure split payouts, route earnings from specific listings to different bank accounts, and set co-host revenue shares."
            backHref="/host/account-settings/payouts"
            backLabel="Back to Payout Settings"
            breadcrumbs={[
              { label: "Payout Settings", href: "/host/account-settings/payouts" },
              { label: "Routing Rules" },
            ]}
          />

          <PayoutRoutingManager
            hostId={actor.id}
            defaultPayoutMethod={defaultMethod}
            listings={listings}
            initialRules={initialRules}
          />

          <div className="mt-8">
            <SettingsHelpCard
              title="Need to add a co-host to a property?"
              description="Co-hosts must be invited and accept their co-hosting invitation for the listing. Once they add a verified payout method, you can allocate a percentage of booking payouts directly to them."
              links={[{ label: "Manage Co-Hosts", href: "/host/co-host" }]}
            />
          </div>
        </section>
      </div>
    </Container>
  );
}
