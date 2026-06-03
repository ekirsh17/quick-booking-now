import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSlotWindowContext,
  isRequestActive,
  slotMatchesNotifyRequest,
  slotMatchesTimeRange,
} from "@notify-time";

describe("rolling preset expiry", () => {
  const timeZone = "America/New_York";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-06T15:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("3-days inactive on 4th merchant-local day after signup", () => {
    const createdAt = "2026-06-03T12:00:00.000Z";
    vi.setSystemTime(new Date("2026-06-05T15:00:00Z"));
    expect(isRequestActive("3-days", createdAt, timeZone)).toBe(true);

    vi.setSystemTime(new Date("2026-06-07T04:00:00.000Z"));
    expect(isRequestActive("3-days", createdAt, timeZone)).toBe(false);
  });

  it("1-week inactive after 7 merchant-local days", () => {
    const createdAt = "2026-06-01T12:00:00.000Z";
    expect(isRequestActive("1-week", createdAt, timeZone)).toBe(true);

    vi.setSystemTime(new Date("2026-06-09T04:00:00.000Z"));
    expect(isRequestActive("1-week", createdAt, timeZone)).toBe(false);
  });
});

describe("slotMatchesNotifyRequest", () => {
  const timeZone = "America/New_York";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T15:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not match when slot is in window but signup expired", () => {
    const slotStart = new Date("2026-06-05T18:00:00.000Z");
    const ctx = buildSlotWindowContext(slotStart, timeZone);
    const createdAt = "2026-06-01T12:00:00.000Z";

    expect(slotMatchesTimeRange("3-days", ctx)).toBe(true);
    expect(isRequestActive("3-days", createdAt, timeZone)).toBe(false);
    expect(slotMatchesNotifyRequest("3-days", createdAt, timeZone, ctx)).toBe(false);
  });

  it("does not match when signup active but slot outside window", () => {
    const slotStart = new Date("2026-06-20T18:00:00.000Z");
    const ctx = buildSlotWindowContext(slotStart, timeZone);
    const createdAt = "2026-06-05T12:00:00.000Z";

    expect(isRequestActive("3-days", createdAt, timeZone)).toBe(true);
    expect(slotMatchesTimeRange("3-days", ctx)).toBe(false);
    expect(slotMatchesNotifyRequest("3-days", createdAt, timeZone, ctx)).toBe(false);
  });
});
