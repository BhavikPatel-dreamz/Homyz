import { CreateListingForm } from "@/components/forms/create-listing-form";
import { Badge, Card } from "@/components/ui";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { listingService } from "@/services/listing.service";
import { Role } from "@/generated/prisma/enums";

function fmtPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function HostListingsPage() {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const { items } = await listingService.listForHost(actor, {
    skip: 0,
    take: 50,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        My listings
      </h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3">
          {items.length === 0 ? (
            <p className="text-sm text-zinc-500">
              You haven&apos;t created any listings yet.
            </p>
          ) : (
            items.map((l) => (
              <Card key={l.id}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">
                      {l.title}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {fmtPrice(l.price)} / night
                    </p>
                  </div>
                  <Badge>{l.published ? "Published" : "Draft"}</Badge>
                </div>
              </Card>
            ))
          )}
        </div>
        <Card>
          <h2 className="mb-4 font-medium text-zinc-900 dark:text-zinc-50">
            Create a listing
          </h2>
          <CreateListingForm />
        </Card>
      </div>
    </div>
  );
}
