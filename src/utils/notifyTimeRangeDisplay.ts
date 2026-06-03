import { format, parseISO } from "date-fns";

export const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const DATE_RANGE_REGEX = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;

export const isDateKey = (value: string): boolean =>
  DATE_KEY_REGEX.test(value) && !value.includes("..");

export const getDateKeyForTimeZone = (date: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
};

const PRESET_LABELS: Record<string, string> = {
  today: "Today",
  "3-days": "Next 3 Days",
  "5-days": "Next 5 Days",
  "1-week": "Next Week",
  tomorrow: "Tomorrow",
  this_week: "This Week",
  next_week: "Next Week",
  anytime: "Anytime",
  custom: "Custom dates",
};

export const parseDateRange = (
  timeRange: string
): { startKey: string; endKey: string } | null => {
  const match = timeRange.match(DATE_RANGE_REGEX);
  if (!match) return null;
  return { startKey: match[1], endKey: match[2] };
};

export const formatCustomDateRangeForStore = (
  startDate: Date,
  endDate: Date,
  timeZone: string
): string => {
  const startKey = getDateKeyForTimeZone(startDate, timeZone);
  const endKey = getDateKeyForTimeZone(endDate, timeZone);
  return `${startKey}..${endKey}`;
};

/** Compact label for tables, cards, and filters (mobile-friendly). */
export const formatTimeRangeDisplay = (timeRange: string): string => {
  const range = parseDateRange(timeRange);
  if (range) {
    const start = parseISO(range.startKey);
    const end = parseISO(range.endKey);

    if (range.startKey === range.endKey) {
      return format(start, "MMM d");
    }

    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
      return `${format(start, "MMM d")}–${format(end, "d")}`;
    }

    if (start.getFullYear() === end.getFullYear()) {
      return `${format(start, "MMM d")}–${format(end, "MMM d")}`;
    }

    return `${format(start, "MMM d, yyyy")}–${format(end, "MMM d, yyyy")}`;
  }

  if (isDateKey(timeRange)) {
    return format(parseISO(timeRange), "MMM d");
  }

  return PRESET_LABELS[timeRange] ?? timeRange;
};

export const isDateRangeKey = (timeRange: string): boolean =>
  DATE_RANGE_REGEX.test(timeRange);

/** Active when today (location TZ) is on or before the range end date. */
export const isDateRangeActive = (
  timeRange: string,
  timeZone: string,
  now: Date = new Date()
): boolean => {
  const range = parseDateRange(timeRange);
  if (!range) return false;
  const todayKey = getDateKeyForTimeZone(now, timeZone);
  return range.endKey >= todayKey;
};

/** Whether a slot date key falls inside an inclusive custom range. */
export const slotMatchesDateRange = (
  slotDateKey: string,
  timeRange: string
): boolean => {
  const range = parseDateRange(timeRange);
  if (!range) return false;
  return slotDateKey >= range.startKey && slotDateKey <= range.endKey;
};
