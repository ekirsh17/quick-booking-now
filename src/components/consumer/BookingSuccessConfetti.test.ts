import { describe, expect, it } from "vitest";
import {
  BOOKING_CONFETTI_TIMING,
  getBookingConfettiMaxDurationMs,
  LEGACY_BOOKING_CONFETTI_TIMING,
  PREVIOUS_BOOKING_CONFETTI_TIMING,
} from "./BookingSuccessConfetti";

describe("getBookingConfettiMaxDurationMs", () => {
  it("is shorter than the legacy confetti duration", () => {
    const current = getBookingConfettiMaxDurationMs();
    const legacy = getBookingConfettiMaxDurationMs(LEGACY_BOOKING_CONFETTI_TIMING);

    expect(current).toBeLessThan(legacy);
    expect(legacy).toBeGreaterThan(5000);
  });

  it("is shorter than the previous shortened confetti duration", () => {
    const current = getBookingConfettiMaxDurationMs();
    const previous = getBookingConfettiMaxDurationMs(PREVIOUS_BOOKING_CONFETTI_TIMING);

    expect(current).toBeLessThan(previous);
    expect(previous).toBeGreaterThan(3000);
  });

  it("remains long enough for the burst to be visible", () => {
    expect(getBookingConfettiMaxDurationMs()).toBeGreaterThan(1500);
  });

  it("uses a safe minimum particle lifetime", () => {
    expect(BOOKING_CONFETTI_TIMING.ticks).toBeGreaterThanOrEqual(120);
  });

  it("staggers phases in ascending order", () => {
    expect(BOOKING_CONFETTI_TIMING.phase2DelayMs).toBeGreaterThan(0);
    expect(BOOKING_CONFETTI_TIMING.phase3DelayMs).toBeGreaterThan(
      BOOKING_CONFETTI_TIMING.phase2DelayMs,
    );
  });
});
