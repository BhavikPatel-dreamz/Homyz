import { Badge, Card } from "@/components/ui";
import { requirePageUser } from "@/lib/permissions/page-guards";
import { bookingService } from "@/services/booking.service";

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function BookingsPage() {
  const actor = await requirePageUser();
  const { items } = await bookingService.listForUser(actor, {
    skip: 0,
    take: 20,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Your bookings
      </h1>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">You have no bookings yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((b) => (
            <Card key={b.id}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {fmtDate(b.startDate)} → {fmtDate(b.endDate)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Listing {b.listingId}
                  </p>
                </div>
                <Badge>{b.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
