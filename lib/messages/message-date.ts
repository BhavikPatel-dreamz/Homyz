const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function parseDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function utcDateKey(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/** Stable across server and browser locales/timezones. */
export function formatMessageTime(value: string): string {
  const date = parseDate(value);
  if (!date) return "";

  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes(),
  ).padStart(2, "0")}`;
}

/** Uses the server-render snapshot so the meaning of "today" cannot change during hydration. */
export function formatConversationListDate(value: string, renderedAt: string): string {
  const date = parseDate(value);
  const referenceDate = parseDate(renderedAt);
  if (!date) return "";

  if (referenceDate && utcDateKey(date) === utcDateKey(referenceDate)) {
    return formatMessageTime(value);
  }

  return `${SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}
