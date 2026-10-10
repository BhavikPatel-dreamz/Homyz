import React from "react";
import { useLanguage } from "@/lib/i18n/language-context";

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
  const { t } = useLanguage();
  const snapshot = asRecord(priceBreakdown);
  const petsCount = typeof snapshot.pets === "number" ? snapshot.pets : 0;

  return (
    <section className="border-b border-zinc-200 py-7" aria-labelledby="guests-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="guests-heading" className="text-xl font-semibold text-[#1F1F1F]">
          {t("booking_details_guest_details", "Guest details")}
        </h2>
        {canModifyGuests && (
          <button
            type="button"
            onClick={onChangeGuests}
            className="text-sm font-semibold text-zinc-800 underline underline-offset-4 hover:text-zinc-600 transition-colors cursor-pointer"
          >
            {t("booking_details_change_guests", "Change guests")}
          </button>
        )}
      </div>

      <div className="mt-5 sm:rounded-2xl rounded-lg border border-zinc-200 bg-white p-5 shadow-2xs">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold text-[#727272] uppercase tracking-wider">
              {t("booking_details_total_guests", "Total Guests")}
            </dt>
            <dd className="mt-1 text-base font-semibold text-[#1F1F1F]">
              {totalGuests} {totalGuests === 1 ? t("booking_details_guest_singular", "guest") : t("booking_details_guests_plural", "guests")}
            </dd>
            <p className="text-sm text-[#727272] mt-0.5">
              {t("booking_details_max_occupancy", { count: maxListingGuests }, "Maximum occupancy: {count}")}
            </p>
          </div>

          <div>
            <dt className="text-xs font-semibold text-[#727272] uppercase tracking-wider">
              {t("booking_details_breakdown", "Breakdown")}
            </dt>
            <dd className="mt-1 text-sm font-medium text-zinc-800">
              {totalGuests === 1
                ? t("booking_details_adult_count", { count: totalGuests }, "{count} adult")
                : t("booking_details_adults_count", { count: totalGuests }, "{count} adults / children")}
            </dd>
            <p className="text-sm text-[#727272] mt-0.5">
              {t("booking_details_infants_accommodated", "Infants accommodated")}
            </p>
          </div>

          <div>
            <dt className="text-xs font-semibold text-[#727272] uppercase tracking-wider">
              {t("booking_details_pets", "Pets")}
            </dt>
            <dd className="mt-1 text-sm font-medium text-zinc-800">
              {petsCount > 0
                ? (petsCount === 1
                    ? t("booking_details_pet_count", { count: petsCount }, "{count} pet")
                    : t("booking_details_pets_count", { count: petsCount }, "{count} pets"))
                : t("booking_details_no_pets", "No pets declared")}
            </dd>
            <p className="text-sm text-[#727272] mt-0.5">
              {t("booking_details_pets_rules", "Subject to listing house rules")}
            </p>
          </div>
        </dl>
      </div>
    </section>
  );
}

