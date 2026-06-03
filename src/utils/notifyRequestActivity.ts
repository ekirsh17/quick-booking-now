import {
  getDateKeyForTimeZone,
  isDateKey,
  isDateRangeActive,
  isDateRangeKey,
} from "@/utils/notifyTimeRangeDisplay";

export { DATE_KEY_REGEX, getDateKeyForTimeZone, isDateKey } from "@/utils/notifyTimeRangeDisplay";

/**
 * Whether a notify_requests row should appear on the merchant waitlist.
 * Keep aligned with cleanup-expired-notifications thresholds where applicable.
 */
export const isRequestActive = (
  timeRange: string,
  createdAt: string,
  timeZone: string
): boolean => {
  const now = new Date();
  const created = new Date(createdAt);
  const todayKey = getDateKeyForTimeZone(now, timeZone);

  if (isDateKey(timeRange)) {
    return timeRange >= todayKey;
  }

  if (isDateRangeKey(timeRange)) {
    return isDateRangeActive(timeRange, timeZone, now);
  }

  const ageMs = now.getTime() - created.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  switch (timeRange) {
    case "today": {
      const createdDayKey = getDateKeyForTimeZone(created, timeZone);
      return createdDayKey === todayKey;
    }
    case "tomorrow":
      return ageMs < 2 * dayMs;
    case "this_week":
      return ageMs < 7 * dayMs;
    case "next_week":
      return ageMs < 14 * dayMs;
    case "anytime":
    case "custom":
    case "3-days":
    case "5-days":
    case "1-week":
      return true;
    default:
      return true;
  }
};
