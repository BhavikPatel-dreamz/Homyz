export type CalendarWeek = {
  key: string;
  dates: Date[];
};

export type CalendarBookingRange<T> = {
  booking: T;
  start: string;
  end: string;
};

export type WeekBookingSegment<T> = {
  booking: T;
  startColumn: number;
  endColumn: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function shiftDateKey(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function dateDistance(start: string, end: string) {
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = end.split("-").map(Number);
  return Math.round((Date.UTC(endYear, endMonth - 1, endDay) - Date.UTC(startYear, startMonth - 1, startDay)) / 86_400_000);
}

export function getCalendarWeeks(month: Date): CalendarWeek[] {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const lastOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - firstOfMonth.getDay());
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(gridEnd.getDate() + (6 - lastOfMonth.getDay()));

  const weeks: CalendarWeek[] = [];
  for (let weekStart = new Date(gridStart); weekStart <= gridEnd; weekStart.setDate(weekStart.getDate() + 7)) {
    const dates = Array.from({ length: 7 }, (_, dayOffset) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + dayOffset);
      return date;
    });
    weeks.push({ key: dateKey(dates[0]), dates });
  }
  return weeks;
}

/** Splits checkout-exclusive reservations into collision-safe week-row bars. */
export function getWeekBookingSegments<T>(
  week: CalendarWeek,
  bookingRanges: readonly CalendarBookingRange<T>[],
): WeekBookingSegment<T>[] {
  const weekStart = dateKey(week.dates[0]);
  const weekEnd = shiftDateKey(weekStart, 7);
  const laneEndDates: string[] = [];

  return bookingRanges
    .filter(({ start, end }) => start < weekEnd && end > weekStart)
    .map(({ booking, start, end }) => {
      const visibleStart = start < weekStart ? weekStart : start;
      const visibleEnd = end > weekEnd ? weekEnd : end;
      const lane = laneEndDates.findIndex((laneEnd) => laneEnd <= visibleStart);
      const laneIndex = lane === -1 ? laneEndDates.length : lane;
      laneEndDates[laneIndex] = visibleEnd;

      return {
        booking,
        startColumn: dateDistance(weekStart, visibleStart) + 1,
        endColumn: dateDistance(weekStart, visibleEnd) + 1,
        lane: laneIndex,
        continuesBefore: start < weekStart,
        continuesAfter: end > weekEnd,
      };
    })
    .sort((left, right) => left.lane - right.lane || left.startColumn - right.startColumn);
}
