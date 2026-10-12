import React from "react";
import { useLanguage } from "@/lib/i18n/language-context";

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
  const { t } = useLanguage();

  const humanize = (value: string) =>
    value
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const translateSafetyEquipment = (item: string): string => {
    if (!item) return "";
    const cleanItem = item.includes(":") ? item.split(":")[0] : item;
    const normalized = cleanItem.toUpperCase().replace(/\s+/g, "_");

    switch (normalized) {
      case "SMOKE_ALARM":
      case "SMOKE_DETECTOR":
        return t("booking_details_smoke_alarm", "Smoke alarm installed");
      case "CARBON_MONOXIDE_ALARM":
      case "CARBON_MONOXIDE_DETECTOR":
      case "CO_ALARM":
      case "CO_DETECTOR":
        return t("booking_details_co_detector", "Carbon monoxide detector");
      case "FIRST_AID_KIT":
      case "FIRST_AID":
        return t("booking_details_first_aid", "First aid kit available");
      case "FIRE_EXTINGUISHER":
        return t("host_fire_extinguisher", "Fire extinguisher");
      case "SECURITY_CAMERA":
        return t("host_safety_security_camera_title", "Exterior security camera present");
      case "NOISE_MONITOR":
        return t("host_safety_noise_monitor_title", "Noise decibel monitor present");
      default:
        return humanize(cleanItem);
    }
  };

  const formatSafetyDisclosure = (entry: string): string | null => {
    if (!entry) return null;
    const parts = entry.split(":");
    const key = parts[0];
    const status = parts[1];
    const details = parts.slice(2).join(":").trim();

    if (status === "NO") return null;

    const labels: Record<string, string> = {
      MUST_CLIMB_STAIRS: t("host_safety_must_climb_stairs", "Guests must climb stairs"),
      POTENTIAL_FOR_NOISE: t("host_safety_potential_noise_short", "Construction or other potential noise during stays"),
      NEARBY_WATER: t("host_safety_nearby_water_title", "Nearby water, like a lake or river"),
      DANGEROUS_ANIMALS: t("host_safety_dangerous_animals_title", "Potentially dangerous animal(s) on the property"),
      SPECIAL_CONSIDERATIONS: t("host_safety_special_considerations_title", "Other safety or regulatory notes"),
    };

    const label = labels[key] ?? humanize(key);
    return status === "YES" ? `${label}${details ? `: ${details}` : ""}` : label;
  };

  const smokingLabel = smokingAllowed
    ? smokingLocation === "OUTSIDE_ONLY"
      ? t("booking_details_smoking_outside", "Smoking allowed outside only")
      : t("booking_details_smoking_allowed", "Smoking allowed")
    : t("booking_details_no_smoking", "No smoking");

  const petsLabel = petsAllowed
    ? maxPets
      ? t("booking_details_pets_allowed_max", `Pets allowed (up to ${maxPets} pets)`)
      : t("booking_details_pets_allowed", "Pets allowed")
    : t("booking_details_no_pets_allowed", "No pets allowed");

  const eventsLabel = eventsAllowed
    ? t("booking_details_events_allowed", "Parties / events allowed")
    : t("booking_details_no_events", "No parties or events");

  const quietHoursLabel = quietHours
    ? quietHoursStart && quietHoursEnd
      ? t("booking_details_quiet_hours_range", `Quiet hours: ${quietHoursStart} – ${quietHoursEnd}`)
      : t("booking_details_quiet_hours_obs", "Quiet hours observed")
    : null;

  return (
    <section className="py-7" aria-labelledby="things-to-know-heading">
      <h2 id="things-to-know-heading" className="text-xl font-semibold text-[#1F1F1F]">
        {t("booking_details_things_to_know", "Things to know")}
      </h2>

      <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* House rules */}
        <div className="sm:rounded-2xl rounded-lg border border-zinc-200 bg-white p-5 shadow-2xs">
          <h3 className="text-sm font-medium text-[#1F1F1F] mb-3 flex items-center gap-2">
            <svg className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{t("booking_details_house_rules", "House Rules")}</span>
          </h3>
          <ul className="space-y-2 text-xs sm:text-sm text-zinc-600">
            <li>
              {t("booking_details_check_in", "Check-in")}: {checkInStart || "3:00 PM"}{checkInEnd ? ` – ${checkInEnd}` : ` ${t("booking_details_onwards", "onwards")}`}
            </li>
            <li>{t("booking_details_check_out", "Check-out")}: {checkOutTime || "11:00 AM"}</li>
            {maxGuests && <li>{t("booking_details_max_occupancy", { count: maxGuests }, "Maximum occupancy: {count}")}</li>}
            <li>{smokingLabel}</li>
            <li>{petsLabel}</li>
            <li>{eventsLabel}</li>
            {quietHoursLabel && <li>{quietHoursLabel}</li>}
          </ul>
        </div>

        {/* Safety & Property Disclosures */}
        <div className="sm:rounded-2xl rounded-lg border border-zinc-200 bg-white p-5 shadow-2xs">
          <h3 className="text-sm font-medium text-[#1F1F1F] mb-3 flex items-center gap-2">
            <svg className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{t("booking_details_safety_features", "Safety & Features")}</span>
          </h3>
          <ul className="space-y-2 text-xs sm:text-sm text-zinc-600">
            {safetyEquipment.length > 0 ? (
              safetyEquipment.map((eq, i) => <li key={i}>{translateSafetyEquipment(eq)}</li>)
            ) : (
              <>
                <li>{t("booking_details_smoke_alarm", "Smoke alarm installed")}</li>
                <li>{t("booking_details_co_detector", "Carbon monoxide detector")}</li>
                <li>{t("booking_details_first_aid", "First aid kit available")}</li>
              </>
            )}
            {safetyDisclosures
              .map(formatSafetyDisclosure)
              .filter((item): item is string => Boolean(item))
              .map((d, i) => (
                <li key={`disc-${i}`} className="text-amber-800 font-medium">
                  {t("booking_details_note", "Note")}: {d}
                </li>
              ))}
          </ul>
        </div>

        {/* Additional Host Rules */}
        {additionalRules && (
          <div className="sm:rounded-2xl rounded-lg border border-zinc-200 bg-white p-5 shadow-2xs sm:col-span-2 lg:col-span-1">
            <h3 className="text-sm font-semibold text-[#1F1F1F] mb-2 flex items-center gap-2">
              <svg className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{t("booking_details_additional_rules", "Host's Additional Rules")}</span>
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

