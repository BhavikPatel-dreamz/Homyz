import { bookingDateKey, shiftBookingDateKey } from "@/lib/booking/booking-date";

/**
 * The product definition used by both search entry points. A flexible month is
 * intentionally a 28-night stay: it is long enough to represent a monthly
 * trip while still allowing listing-specific maximum-night rules to decide
 * whether a particular property can host it.
 */
export const FLEXIBLE_STAY_NIGHTS = {
  weekend: 2,
  week: 7,
  month: 28,
} as const;

export type FlexibleDuration = keyof typeof FLEXIBLE_STAY_NIGHTS;

export type FlexibleCandidateStay = {
  checkIn: string;
  checkOut: string;
};

/**
 * Shared, date-free copy for a flexible selection. It deliberately describes
 * intent rather than a concrete stay: the matching candidate is only selected
 * after a guest chooses final dates on the listing page.
 */
export function formatFlexibleStaySummary(
  duration: FlexibleDuration | string,
  months: readonly string[],
  locale = "en-US",
  monthStyle: "long" | "short" = "long",
): string {
  const label = `${duration.slice(0, 1).toUpperCase()}${duration.slice(1).toLowerCase()}`;
  const validMonths = months.filter(isFlexibleMonthKey);
  if (!validMonths.length) return `${label} · Choose months`;

  const formatter = new Intl.DateTimeFormat(locale, { month: monthStyle });
  const names = validMonths.map((key) => {
    const [year, month] = key.split("-").map(Number);
    return formatter.format(new Date(year, month - 1, 1));
  });

  return `${label} in ${names.join(", ")}`;
}

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isFlexibleMonthKey(value: string): boolean {
  return MONTH_KEY.test(value);
}

/**
 * Generates every bookable *arrival opportunity* in the selected months.
 * Weekend searches use Friday arrivals; week and month searches consider each
 * day so a listing is never treated as unavailable because its first day of a
 * month is blocked. The caller still runs each candidate through the shared
 * availability policy before returning a result.
 */
export function generateFlexibleCandidateStays(
  months: readonly string[],
  duration: FlexibleDuration,
): FlexibleCandidateStay[] {
  const nights = FLEXIBLE_STAY_NIGHTS[duration];
  const result: FlexibleCandidateStay[] = [];

  for (const key of [...new Set(months)].sort()) {
    if (!isFlexibleMonthKey(key)) continue;
    const [year, month] = key.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

    for (let day = 1; day <= lastDay; day += 1) {
      const date = new Date(Date.UTC(year, month - 1, day));
      // Friday is 5 in JavaScript's day-of-week indexing.
      if (duration === "weekend" && date.getUTCDay() !== 5) continue;
      const checkIn = bookingDateKey(date);
      result.push({ checkIn, checkOut: shiftBookingDateKey(checkIn, nights) });
    }
  }

  return result;
}

export function flexibleSearchWindow(candidates: readonly FlexibleCandidateStay[]) {
  if (!candidates.length) return null;
  const sorted = [...candidates].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  return {
    start: sorted[0].checkIn,
    end: sorted.reduce((latest, candidate) => candidate.checkOut > latest ? candidate.checkOut : latest, sorted[0].checkOut),
  };
}
