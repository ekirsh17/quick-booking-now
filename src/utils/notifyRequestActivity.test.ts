import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDateKeyForTimeZone,
  isDateKey,
  isRequestActive,
} from "./notifyRequestActivity";

describe("isDateKey", () => {
  it("recognizes YYYY-MM-DD date keys", () => {
    expect(isDateKey("2026-06-02")).toBe(true);
    expect(isDateKey("today")).toBe(false);
    expect(isDateKey("3-days")).toBe(false);
  });
});

describe("isRequestActive", () => {
  const timeZone = "America/New_York";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T15:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats date keys on or after today as active", () => {
    const todayKey = getDateKeyForTimeZone(new Date(), timeZone);
    const createdAt = "2026-06-01T12:00:00.000Z";

    expect(todayKey).toBe("2026-06-03");
    expect(isRequestActive("2026-06-03", createdAt, timeZone)).toBe(true);
    expect(isRequestActive("2026-06-04", createdAt, timeZone)).toBe(true);
  });

  it("treats past date keys as inactive (expired Today signup)", () => {
    const createdAt = "2026-06-02T21:17:12.788Z";

    expect(isRequestActive("2026-06-02", createdAt, timeZone)).toBe(false);
  });

  it("keeps rolling windows like 3-days active within window", () => {
    const createdAt = "2026-06-03T04:00:00.000Z";

    expect(isRequestActive("3-days", createdAt, timeZone)).toBe(true);
  });

  it("treats legacy today string using created day in location TZ", () => {
    const createdAt = "2026-06-03T04:00:00.000Z";
    expect(isRequestActive("today", createdAt, timeZone)).toBe(true);

    const yesterdayCreated = "2026-06-02T21:00:00.000Z";
    expect(isRequestActive("today", yesterdayCreated, timeZone)).toBe(false);
  });

  it("treats custom date ranges as active through end date", () => {
    const createdAt = "2026-06-01T12:00:00.000Z";

    expect(isRequestActive("2026-06-01..2026-06-05", createdAt, timeZone)).toBe(true);
    expect(isRequestActive("2026-06-01..2026-06-02", createdAt, timeZone)).toBe(false);
    expect(isRequestActive("2026-06-04..2026-06-10", createdAt, timeZone)).toBe(true);
  });
});

describe("resubmit renewal scenario", () => {
  const timeZone = "America/New_York";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("inactive yesterday date key becomes active after storing today key", () => {
    const createdAt = "2026-06-02T21:17:12.788Z";
    const expiredRange = "2026-06-02";
    const renewedRange = getDateKeyForTimeZone(new Date(), timeZone);

    expect(renewedRange).toBe("2026-06-03");
    expect(isRequestActive(expiredRange, createdAt, timeZone)).toBe(false);
    expect(isRequestActive(renewedRange, new Date().toISOString(), timeZone)).toBe(true);
  });
});
