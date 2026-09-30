import React from "react";

interface BookingHouseRulesProps {
  checkInStart?: string | null;
  checkInEnd?: string | null;
  checkOutTime?: string | null;
  maxGuests?: number | null;
  petsAllowed?: boolean | null;
  maxPets?: number | null;
  petFee?: number | null;
  smokingAllowed?: boolean | null;
  smokingLocation?: string | null;
  eventsAllowed?: boolean | null;
  quietHours?: boolean | null;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  additionalRules?: string | null;
  safetyEquipment?: string[];
  safetyDisclosures?: string[];
}

export function BookingHouseRules({
  checkInStart,
  checkInEnd,
  checkOutTime,
  maxGuests,
  petsAllowed,
  maxPets,
  petFee,
  smokingAllowed,
  smokingLocation,
  eventsAllowed,
  quietHours,
  quietHoursStart,
  quietHoursEnd,
  additionalRules,
  safetyEquipment = [],
  safetyDisclosures = [],
}: BookingHouseRulesProps) {
  const smokingLabel = smokingAllowed
    ? smokingLocation === "OUTSIDE_ONLY"
      ? "Smoking allowed outside only"
      : "Smoking allowed"
    : "No smoking";

  const petsLabel = petsAllowed
    ? maxPets
      ? `Pets allowed (up to ${maxPets} pets)`
      : "Pets allowed"
    : "No pets allowed";

  const eventsLabel = eventsAllowed ? "Parties / events allowed" : "No parties or events";

  const quietHoursLabel = quietHours
    ? quietHoursStart && quietHoursEnd
      ? `Quiet hours: ${quietHoursStart} – ${quietHoursEnd}`
      : "Quiet hours observed"
    : null;

  return (
    <section className="py-7" aria-labelledby="things-to-know-heading">
      <h2 id="things-to-know-heading" className="text-xl font-semibold text-[#1F1F1F]">
        Things to know
      </h2>

      <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* House rules */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <h3 className="text-sm font-semibold text-[#1F1F1F] mb-3 flex items-center gap-2">
            <svg className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>House Rules</span>
          </h3>
          <ul className="space-y-2 text-xs sm:text-sm text-zinc-600">
            <li>
              Check-in: {checkInStart || "3:00 PM"}{checkInEnd ? ` – ${checkInEnd}` : " onwards"}
            </li>
            <li>Checkout: {checkOutTime || "11:00 AM"}</li>
            {maxGuests && <li>Maximum guests: {maxGuests}</li>}
            <li>{smokingLabel}</li>
            <li>{petsLabel}</li>
            <li>{eventsLabel}</li>
            {quietHoursLabel && <li>{quietHoursLabel}</li>}
          </ul>
        </div>

        {/* Safety & Property Disclosures */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <h3 className="text-sm font-semibold text-[#1F1F1F] mb-3 flex items-center gap-2">
            <svg className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Safety & Features</span>
          </h3>
          <ul className="space-y-2 text-xs sm:text-sm text-zinc-600">
            {safetyEquipment.length > 0 ? (
              safetyEquipment.map((eq, i) => <li key={i}>{eq}</li>)
            ) : (
              <>
                <li>Smoke alarm installed</li>
                <li>Carbon monoxide detector</li>
                <li>First aid kit available</li>
              </>
            )}
            {safetyDisclosures.map((d, i) => (
              <li key={`disc-${i}`} className="text-amber-800 font-medium">
                Note: {d}
              </li>
            ))}
          </ul>
        </div>

        {/* Additional Host Rules */}
        {additionalRules && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs sm:col-span-2 lg:col-span-1">
            <h3 className="text-sm font-semibold text-[#1F1F1F] mb-2 flex items-center gap-2">
              <svg className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Host&apos;s Additional Rules</span>
            </h3>
            <p className="whitespace-pre-line text-xs sm:text-sm text-zinc-600 leading-relaxed">
              {additionalRules}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

