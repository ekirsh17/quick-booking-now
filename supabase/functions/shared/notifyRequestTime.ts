/**
 * Canonical waitlist / notify time-range logic.
 * Used by the frontend (via @notify-time alias) and Supabase edge functions.
 */

export const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const DATE_RANGE_REGEX = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;

export const isDateKey = (value: string): boolean =>
  DATE_KEY_REGEX.test(value) && !value.includes("..");

export const isDateRangeKey = (timeRange: string): boolean =>
  DATE_RANGE_REGEX.test(timeRange);

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

/** Add calendar days to a YYYY-MM-DD key (merchant-local calendar day keys). */
export const addCalendarDaysToDateKey = (dateKey: string, days: number): string => {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
};

export const getTzMidnightUtc = (date: Date, timeZone: string): Date => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return new Date(Date.UTC(year, month - 1, day));
};

export interface SlotWindowContext {
  slotDateKey: string;
  slotDateMidnightMs: number;
  todayMidnightMs: number;
  tomorrowMidnightMs: number;
  weekEndMidnightMs: number;
  nextWeekStartMidnightMs: number;
  nextWeekEndMidnightMs: number;
  dayOffsetMidnightMs: (days: number) => number;
}

export const buildSlotWindowContext = (
  slotStartDate: Date,
  merchantTz: string
): SlotWindowContext => {
  const now = new Date();
  const today = getTzMidnightUtc(now, merchantTz);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const weekEnd = new Date(today);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const nextWeekStart = new Date(today);
  nextWeekStart.setUTCDate(nextWeekStart.getUTCDate() + 7);

  const nextWeekEnd = new Date(nextWeekStart);
  nextWeekEnd.setUTCDate(nextWeekEnd.getUTCDate() + 7);

  const slotDateForFilter = getTzMidnightUtc(slotStartDate, merchantTz);
  const slotDateKey = getDateKeyForTimeZone(slotStartDate, merchantTz);

  const dayOffsetMidnightMs = (days: number) => {
    const end = new Date(today);
    end.setUTCDate(end.getUTCDate() + days);
    return end.getTime();
  };

  return {
    slotDateKey,
    slotDateMidnightMs: slotDateForFilter.getTime(),
    todayMidnightMs: today.getTime(),
    tomorrowMidnightMs: tomorrow.getTime(),
    weekEndMidnightMs: weekEnd.getTime(),
    nextWeekStartMidnightMs: nextWeekStart.getTime(),
    nextWeekEndMidnightMs: nextWeekEnd.getTime(),
    dayOffsetMidnightMs,
  };
};

const isDateRangeActive = (
  timeRange: string,
  timeZone: string,
  now: Date = new Date()
): boolean => {
  const range = parseDateRange(timeRange);
  if (!range) return false;
  const todayKey = getDateKeyForTimeZone(now, timeZone);
  return range.endKey >= todayKey;
};

const rollingPresetWindowDays = (timeRange: string): number | null => {
  switch (timeRange) {
    case "3-days":
      return 3;
    case "5-days":
      return 5;
    case "1-week":
      return 7;
    default:
      return null;
  }
};

const isRollingPresetActive = (
  timeRange: string,
  createdAt: string,
  timeZone: string,
  now: Date = new Date()
): boolean => {
  const windowDays = rollingPresetWindowDays(timeRange);
  if (windowDays === null) return true;

  const createdDayKey = getDateKeyForTimeZone(new Date(createdAt), timeZone);
  const todayKey = getDateKeyForTimeZone(now, timeZone);
  const endExclusive = addCalendarDaysToDateKey(createdDayKey, windowDays);
  return todayKey < endExclusive;
};

/**
 * Whether a notify_requests row should appear on the merchant waitlist / consumer active list.
 */
export const isRequestActive = (
  timeRange: string,
  createdAt: string,
  timeZone: string,
  now: Date = new Date()
): boolean => {
  const created = new Date(createdAt);
  const todayKey = getDateKeyForTimeZone(now, timeZone);

  if (isDateKey(timeRange)) {
    return timeRange >= todayKey;
  }

  if (isDateRangeKey(timeRange)) {
    return isDateRangeActive(timeRange, timeZone, now);
  }

  const rollingDays = rollingPresetWindowDays(timeRange);
  if (rollingDays !== null) {
    return isRollingPresetActive(timeRange, createdAt, timeZone, now);
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
      return true;
    default:
      return true;
  }
};

/** Slot date matches time_range window (ignores signup age). */
export const slotMatchesTimeRange = (timeRange: string, ctx: SlotWindowContext): boolean => {
  if (typeof timeRange !== "string") return false;

  const range = parseDateRange(timeRange);
  if (range) {
    return ctx.slotDateKey >= range.startKey && ctx.slotDateKey <= range.endKey;
  }

  if (isDateKey(timeRange)) {
    return timeRange === ctx.slotDateKey;
  }

  const slotMs = ctx.slotDateMidnightMs;

  switch (timeRange) {
    case "today":
      return slotMs === ctx.todayMidnightMs;
    case "3-days":
      return slotMs >= ctx.todayMidnightMs && slotMs < ctx.dayOffsetMidnightMs(3);
    case "5-days":
      return slotMs >= ctx.todayMidnightMs && slotMs < ctx.dayOffsetMidnightMs(5);
    case "1-week":
      return slotMs >= ctx.todayMidnightMs && slotMs < ctx.dayOffsetMidnightMs(7);
    case "tomorrow":
      return slotMs === ctx.tomorrowMidnightMs;
    case "this_week":
      return slotMs >= ctx.todayMidnightMs && slotMs < ctx.weekEndMidnightMs;
    case "next_week":
      return slotMs >= ctx.nextWeekStartMidnightMs && slotMs < ctx.nextWeekEndMidnightMs;
    case "anytime":
    case "custom":
      return true;
    default:
      return true;
  }
};

/** Slot + signup still active (used by notify-consumers). */
export const slotMatchesNotifyRequest = (
  timeRange: string,
  createdAt: string,
  merchantTz: string,
  ctx: SlotWindowContext
): boolean => {
  if (!slotMatchesTimeRange(timeRange, ctx)) {
    return false;
  }
  return isRequestActive(timeRange, createdAt, merchantTz);
};
