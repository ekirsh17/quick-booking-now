import { describe, expect, it } from "vitest";
import {
  formatCustomDateRangeForStore,
  formatTimeRangeDisplay,
  parseDateRange,
  slotMatchesDateRange,
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

describe("slotMatchesDateRange", () => {
  it("matches slot keys inclusively", () => {
    const range = "2026-06-05..2026-06-10";
    expect(slotMatchesDateRange("2026-06-04", range)).toBe(false);
    expect(slotMatchesDateRange("2026-06-05", range)).toBe(true);
    expect(slotMatchesDateRange("2026-06-10", range)).toBe(true);
    expect(slotMatchesDateRange("2026-06-11", range)).toBe(false);
  });
});
