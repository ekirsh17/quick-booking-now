import { format, parseISO } from "date-fns";
import {
  getDateKeyForTimeZone,
  isDateKey,
  parseDateRange,
} from "@notify-time";

export {
  DATE_KEY_REGEX,
  DATE_RANGE_REGEX,
  formatCustomDateRangeForStore,
  getDateKeyForTimeZone,
  isDateKey,
  isDateRangeKey,
  parseDateRange,
} from "@notify-time";

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
