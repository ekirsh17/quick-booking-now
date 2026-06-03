import { format, parseISO } from "date-fns";
import {
  addCalendarDaysToDateKey,
  getDateKeyForTimeZone,
  isDateKey,
  isDateRangeKey,
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

/** Primary waitlist filter value when filtering by custom-stored availability. */
export const WAITLIST_CUSTOM_TIME_RANGE_FILTER = "__custom__";

/** Presets on the consumer Notify Me page (today / next 3 days / next week). */
export const WAITLIST_TIME_RANGE_PRESET_OPTIONS = ["today", "3-days", "1-week"] as const;

/** Values that belong in the custom waitlist sub-filter (not preset dropdown). */
export function isCustomStoredTimeRange(timeRange: string): boolean {
  return isDateRangeKey(timeRange) || isDateKey(timeRange) || timeRange === "custom";
}

const sortTimeRangeFilterKeys = (values: string[]): string[] => {
  const sortKey = (value: string) => {
    const range = parseDateRange(value);
    if (range) return range.startKey;
    if (isDateKey(value)) return value;
    return value;
  };

  return [...values].sort((a, b) => {
    const aIsDated = isDateKey(a) || isDateRangeKey(a);
    const bIsDated = isDateKey(b) || isDateRangeKey(b);

    if (aIsDated && bIsDated) return sortKey(a).localeCompare(sortKey(b));
    if (aIsDated) return -1;
    if (bIsDated) return 1;
    return formatTimeRangeDisplay(a).localeCompare(formatTimeRangeDisplay(b));
  });
};

export function partitionTimeRangesForWaitlistFilter(timeRanges: string[]): {
  presets: string[];
  custom: string[];
} {
  const unique = [...new Set(timeRanges)];
  const presets = unique.filter((value) => !isCustomStoredTimeRange(value));
  const custom = unique.filter((value) => isCustomStoredTimeRange(value));

  return {
    presets: sortTimeRangeFilterKeys(presets),
    custom: sortTimeRangeFilterKeys(custom),
  };
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

/** Inclusive overlap between two calendar-day ranges (YYYY-MM-DD keys). */
export const dateRangeKeysOverlap = (
  aStartKey: string,
  aEndKey: string,
  bStartKey: string,
  bEndKey: string
): boolean => aStartKey <= bEndKey && aEndKey >= bStartKey;

/**
 * Merchant-local availability window for a waitlist row (aligned with slot matching presets).
 * Returns null for unbounded ranges (anytime / legacy custom without stored dates).
 */
export const getRequestAvailabilityBounds = (
  timeRange: string,
  timeZone: string,
  now: Date = new Date()
): { startKey: string; endKey: string } | null => {
  const storedRange = parseDateRange(timeRange);
  if (storedRange) return storedRange;

  if (isDateKey(timeRange)) {
    return { startKey: timeRange, endKey: timeRange };
  }

  const todayKey = getDateKeyForTimeZone(now, timeZone);

  switch (timeRange) {
    case "today":
      return { startKey: todayKey, endKey: todayKey };
    case "3-days":
      return { startKey: todayKey, endKey: addCalendarDaysToDateKey(todayKey, 2) };
    case "5-days":
      return { startKey: todayKey, endKey: addCalendarDaysToDateKey(todayKey, 4) };
    case "1-week":
      return { startKey: todayKey, endKey: addCalendarDaysToDateKey(todayKey, 6) };
    case "tomorrow": {
      const tomorrowKey = addCalendarDaysToDateKey(todayKey, 1);
      return { startKey: tomorrowKey, endKey: tomorrowKey };
    }
    case "this_week":
      return { startKey: todayKey, endKey: addCalendarDaysToDateKey(todayKey, 6) };
    case "next_week":
      return {
        startKey: addCalendarDaysToDateKey(todayKey, 7),
        endKey: addCalendarDaysToDateKey(todayKey, 13),
      };
    case "anytime":
    case "custom":
      return null;
    default:
      return null;
  }
};

/** Whether a waitlist row's availability overlaps a merchant-selected filter range. */
export const waitlistRequestMatchesFilterRange = (
  requestTimeRange: string,
  filterStartKey: string,
  filterEndKey: string,
  timeZone: string,
  now: Date = new Date()
): boolean => {
  const bounds = getRequestAvailabilityBounds(requestTimeRange, timeZone, now);
  if (!bounds) return true;
  return dateRangeKeysOverlap(
    bounds.startKey,
    bounds.endKey,
    filterStartKey,
    filterEndKey
  );
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
