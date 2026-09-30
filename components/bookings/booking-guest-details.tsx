import React from "react";

interface BookingGuestDetailsProps {
  totalGuests: number;
  maxListingGuests: number;
  priceBreakdown?: unknown;
  canModifyGuests: boolean;
  onChangeGuests: () => void;
}

function asRecord(val: unknown): Record<string, unknown> {
  return val && typeof val === "object" && !Array.isArray(val) ? (val as Record<string, unknown>) : {};
}

export function BookingGuestDetails({
  totalGuests,
  maxListingGuests,
  priceBreakdown,
  canModifyGuests,
  onChangeGuests,
}: BookingGuestDetailsProps) {
  const snapshot = asRecord(priceBreakdown);
  const petsCount = typeof snapshot.pets === "number" ? snapshot.pets : 0;

  return (
    <section className="border-b border-zinc-200 py-7" aria-labelledby="guests-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="guests-heading" className="text-xl font-semibold text-[#1F1F1F]">
          Guest details
        </h2>
        {canModifyGuests && (
          <button
            type="button"
            onClick={onChangeGuests}
            className="text-sm font-semibold text-zinc-800 underline underline-offset-4 hover:text-zinc-600 transition-colors cursor-pointer"
          >
            Change guests
          </button>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold text-[#727272] uppercase tracking-wider">Total Guests</dt>
            <dd className="mt-1 text-base font-semibold text-[#1F1F1F]">
              {totalGuests} {totalGuests === 1 ? "guest" : "guests"}
            </dd>
            <p className="text-xs text-[#727272] mt-0.5">Maximum occupancy: {maxListingGuests}</p>
          </div>

          <div>
            <dt className="text-xs font-semibold text-[#727272] uppercase tracking-wider">Breakdown</dt>
            <dd className="mt-1 text-sm font-medium text-zinc-800">
              {totalGuests} {totalGuests === 1 ? "adult" : "adults / children"}
            </dd>
            <p className="text-xs text-[#727272] mt-0.5">Infants accommodated</p>
          </div>

          <div>
            <dt className="text-xs font-semibold text-[#727272] uppercase tracking-wider">Pets</dt>
            <dd className="mt-1 text-sm font-medium text-zinc-800">
              {petsCount > 0 ? `${petsCount} ${petsCount === 1 ? "pet" : "pets"}` : "No pets declared"}
            </dd>
            <p className="text-xs text-[#727272] mt-0.5">Subject to listing house rules</p>
          </div>
        </dl>
      </div>
    </section>
  );
}

