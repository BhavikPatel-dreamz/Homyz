/**
 * Canonical 12-hour / 24-hour time formatting and parsing helpers for reservations and listings.
 */

export function formatTime12h(timeStr: string | null | undefined, fallback = "12:00 PM"): string {
  if (!timeStr) return fallback;
  const trimmed = timeStr.trim();
  if (!trimmed || /flexible/i.test(trimmed)) return fallback;

  // 12-hour format: "3:00 PM", "3:00pm", "11:00 am", "11 am"
  const m12 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (m12) {
    const hour = parseInt(m12[1], 10);
    const min = m12[2] || "00";
    const period = m12[3].toUpperCase();
    return `${hour}:${min} ${period}`;
  }

  // 24-hour format: "15:00", "07:30", "11:00", "9:00"
  const m24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    let hour = parseInt(m24[1], 10);
    const min = m24[2];
    const period = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${min} ${period}`;
  }

  return trimmed;
}

export function parseTimeMinutes(timeStr: string | null | undefined, fallbackMinutes = 720): number {
  if (!timeStr) return fallbackMinutes;
  const trimmed = timeStr.trim();
  if (!trimmed || /flexible/i.test(trimmed)) return fallbackMinutes;

  const m12 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (m12) {
    let hour = parseInt(m12[1], 10);
    const min = parseInt(m12[2] || "0", 10);
    const isPm = m12[3].toLowerCase() === "pm";
    if (isPm && hour < 12) hour += 12;
    if (!isPm && hour === 12) hour = 0;
    return hour * 60 + min;
  }

  const m24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const hour = parseInt(m24[1], 10);
    const min = parseInt(m24[2], 10);
    return hour * 60 + min;
  }

  return fallbackMinutes;
}

