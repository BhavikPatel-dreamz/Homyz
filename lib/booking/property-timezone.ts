import { bookingDateKey, parseBookingDateParts, type BookingDateInput } from "@/lib/booking/booking-date";
import { formatTime12h, parseTimeMinutes } from "@/lib/booking/booking-time";

export const DEFAULT_PROPERTY_TIME_ZONE = "UTC";

type PropertyLocation = {
  propertyTimeZone?: string | null;
  city?: string | null;
  country?: string | null;
};

const COUNTRY_TIME_ZONES: Record<string, string> = {
  "saudi arabia": "Asia/Riyadh",
  "saudi arabia - sa": "Asia/Riyadh",
  "united arab emirates": "Asia/Dubai",
  "qatar": "Asia/Qatar",
  "kuwait": "Asia/Kuwait",
  "bahrain": "Asia/Bahrain",
  "oman": "Asia/Muscat",
  "india": "Asia/Kolkata",
  "japan": "Asia/Tokyo",
  "singapore": "Asia/Singapore",
  "united kingdom": "Europe/London",
};

const CITY_TIME_ZONES: Record<string, string> = {
  riyadh: "Asia/Riyadh",
  jeddah: "Asia/Riyadh",
  dubai: "Asia/Dubai",
  doha: "Asia/Qatar",
  mumbai: "Asia/Kolkata",
  delhi: "Asia/Kolkata",
  london: "Europe/London",
  "new york": "America/New_York",
  "los angeles": "America/Los_Angeles",
};

export function isValidTimeZone(value: string | null | undefined): value is string {
  if (!value?.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

/** Resolves a verified location without ever using the viewer or server timezone. */
export function resolvePropertyTimeZone(location: PropertyLocation): string {
  if (isValidTimeZone(location.propertyTimeZone)) return location.propertyTimeZone;
  const city = location.city?.trim().toLowerCase();
  if (city && CITY_TIME_ZONES[city]) return CITY_TIME_ZONES[city];
  const country = location.country?.trim().toLowerCase();
  return (country && COUNTRY_TIME_ZONES[country]) || DEFAULT_PROPERTY_TIME_ZONE;
}

function zonedParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute"), second: value("second") };
}

/** Converts a property-local date + clock time to its one real UTC instant. */
export function propertyLocalDateTimeToUtc(
  calendarDate: BookingDateInput,
  time: string | null | undefined,
  propertyTimeZone: string | null | undefined,
  fallbackHour: number,
  fallbackMinute = 0,
): Date {
  const date = parseBookingDateParts(calendarDate);
  if (!date) return new Date(Number.NaN);
  const [hour, minute] = (() => {
    const value = parseTimeMinutes(time, fallbackHour * 60 + fallbackMinute);
    return [Math.floor(value / 60), value % 60] as const;
  })();
  const timeZone = resolvePropertyTimeZone({ propertyTimeZone });
  const desired = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  const offsetAt = (instant: Date) => {
    const local = zonedParts(instant, timeZone);
    return Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second) - instant.getTime();
  };
  let utc = desired - offsetAt(new Date(desired));
  // Re-evaluate after the first conversion so DST boundaries use the local
  // offset at the requested clock time instead of the offset at UTC midnight.
  utc = desired - offsetAt(new Date(utc));
  return new Date(utc);
}

export function propertyDateKey(now: Date, propertyTimeZone: string | null | undefined): string {
  const timeZone = resolvePropertyTimeZone({ propertyTimeZone });
  const local = zonedParts(now, timeZone);
  return `${String(local.year).padStart(4, "0")}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
}

export function reservationSchedule(input: {
  startDate: BookingDateInput;
  endDate: BookingDateInput;
  propertyTimeZone?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
}) {
  const propertyTimeZone = resolvePropertyTimeZone({ propertyTimeZone: input.propertyTimeZone });
  return {
    propertyTimeZone,
    scheduledCheckInAt: propertyLocalDateTimeToUtc(input.startDate, input.checkInTime, propertyTimeZone, 15),
    scheduledCheckOutAt: propertyLocalDateTimeToUtc(input.endDate, input.checkOutTime, propertyTimeZone, 11),
  };
}

export function formatPropertyStayMoment(date: BookingDateInput, time: string | null | undefined, locale = "en-US") {
  return `${new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${bookingDateKey(date)}T00:00:00.000Z`))} · ${formatTime12h(time, "")}`.trim();
}
