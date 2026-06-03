import { describe, expect, it } from "vitest";
import {
  dateRangeKeysOverlap,
  formatCustomDateRangeForStore,
  formatTimeRangeDisplay,
  getRequestAvailabilityBounds,
  isCustomStoredTimeRange,
  partitionTimeRangesForWaitlistFilter,
  parseDateRange,
  slotMatchesDateRange,
  WAITLIST_CUSTOM_TIME_RANGE_FILTER,
  waitlistRequestMatchesFilterRange,
} from "./notifyTimeRangeDisplay";

describe("formatTimeRangeDisplay", () => {
  it("formats same-month ranges compactly", () => {
    expect(formatTimeRangeDisplay("2026-06-05..2026-06-12")).toBe("Jun 5–12");
  });

  it("formats cross-month ranges within a year", () => {
    expect(formatTimeRangeDisplay("2026-06-28..2026-07-04")).toBe("Jun 28–Jul 4");
  });

  it("formats single-day ranges as one date", () => {
    expect(formatTimeRangeDisplay("2026-06-05..2026-06-05")).toBe("Jun 5");
  });

  it("labels legacy custom without stored dates", () => {
    expect(formatTimeRangeDisplay("custom")).toBe("Custom dates");
  });
});

describe("formatCustomDateRangeForStore", () => {
  it("stores inclusive range keys in merchant timezone", () => {
    const start = new Date("2026-06-05T12:00:00Z");
    const end = new Date("2026-06-10T12:00:00Z");
    expect(formatCustomDateRangeForStore(start, end, "America/New_York")).toBe(
      "2026-06-05..2026-06-10"
    );
  });
});

describe("parseDateRange", () => {
  it("parses stored range strings", () => {
    expect(parseDateRange("2026-06-01..2026-06-15")).toEqual({
      startKey: "2026-06-01",
      endKey: "2026-06-15",
    });
  });
});

describe("isCustomStoredTimeRange", () => {
  it("classifies date ranges, single-day keys, and legacy custom", () => {
    expect(isCustomStoredTimeRange("2026-06-05..2026-06-10")).toBe(true);
    expect(isCustomStoredTimeRange("2026-06-05")).toBe(true);
    expect(isCustomStoredTimeRange("custom")).toBe(true);
    expect(isCustomStoredTimeRange("3-days")).toBe(false);
  });
});

describe("partitionTimeRangesForWaitlistFilter", () => {
  it("splits presets from custom stored values", () => {
    const { presets, custom } = partitionTimeRangesForWaitlistFilter([
      "3-days",
      "2026-06-05..2026-06-10",
      "1-week",
      "2026-06-03",
    ]);

    expect(presets).toEqual(["3-days", "1-week"]);
    expect(custom).toEqual(["2026-06-03", "2026-06-05..2026-06-10"]);
  });

  it("exports custom filter sentinel", () => {
    expect(WAITLIST_CUSTOM_TIME_RANGE_FILTER).toBe("__custom__");
  });
});

describe("dateRangeKeysOverlap", () => {
  it("detects inclusive overlap", () => {
    expect(dateRangeKeysOverlap("2026-06-05", "2026-06-10", "2026-06-08", "2026-06-12")).toBe(true);
    expect(dateRangeKeysOverlap("2026-06-05", "2026-06-07", "2026-06-08", "2026-06-12")).toBe(false);
  });
});

describe("waitlistRequestMatchesFilterRange", () => {
  const tz = "America/New_York";
  const now = new Date("2026-06-05T15:00:00Z");

  it("matches stored custom ranges that overlap the filter", () => {
    expect(
      waitlistRequestMatchesFilterRange(
        "2026-06-01..2026-06-08",
        "2026-06-05",
        "2026-06-10",
        tz,
        now
      )
    ).toBe(true);
    expect(
      waitlistRequestMatchesFilterRange(
        "2026-06-01..2026-06-03",
        "2026-06-05",
        "2026-06-10",
        tz,
        now
      )
    ).toBe(false);
  });

  it("matches preset windows against the filter range", () => {
    const todayBounds = getRequestAvailabilityBounds("today", tz, now);
    expect(todayBounds).toEqual({ startKey: "2026-06-05", endKey: "2026-06-05" });
    expect(waitlistRequestMatchesFilterRange("today", "2026-06-05", "2026-06-05", tz, now)).toBe(true);
    expect(waitlistRequestMatchesFilterRange("today", "2026-06-06", "2026-06-10", tz, now)).toBe(false);
  });

  it("includes unbounded anytime requests", () => {
    expect(waitlistRequestMatchesFilterRange("anytime", "2026-06-01", "2026-06-02", tz, now)).toBe(true);
  });
});

describe("slotMatchesDateRange", () => {
  it("matches slot keys inclusively", () => {
    const range = "2026-06-05..2026-06-10";
    expect(slotMatchesDateRange("2026-06-04", range)).toBe(false);
    expect(slotMatchesDateRange("2026-06-05", range)).toBe(true);
    expect(slotMatchesDateRange("2026-06-10", range)).toBe(true);
    expect(slotMatchesDateRange("2026-06-11", range)).toBe(false);
  });
});
