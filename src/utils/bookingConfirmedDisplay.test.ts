import { describe, expect, it } from "vitest";
import {
  resolveBookingConfirmedScenario,
  shouldShowBookingSuccessConfetti,
} from "./bookingConfirmedDisplay";

describe("resolveBookingConfirmedScenario", () => {
  it("returns scenario 2 when merchant uses a booking system", () => {
    expect(resolveBookingConfirmedScenario(true, true)).toBe(2);
    expect(resolveBookingConfirmedScenario(true, false)).toBe(2);
  });

  it("returns scenario 3 when confirmation is required without a booking system", () => {
    expect(resolveBookingConfirmedScenario(false, true)).toBe(3);
  });

  it("returns scenario 4 for auto-confirm native bookings", () => {
    expect(resolveBookingConfirmedScenario(false, false)).toBe(4);
  });
});

describe("shouldShowBookingSuccessConfetti", () => {
  it("shows confetti for auto-confirm scenario 4", () => {
    expect(shouldShowBookingSuccessConfetti(4, "booked")).toBe(true);
    expect(shouldShowBookingSuccessConfetti(4, "pending_confirmation")).toBe(true);
  });

  it("shows confetti for manually confirmed scenario 3 slots only when booked", () => {
    expect(shouldShowBookingSuccessConfetti(3, "booked")).toBe(true);
    expect(shouldShowBookingSuccessConfetti(3, "pending_confirmation")).toBe(false);
  });

  it("never shows confetti for third-party booking flows", () => {
    expect(shouldShowBookingSuccessConfetti(1, "booked")).toBe(false);
    expect(shouldShowBookingSuccessConfetti(2, "booked")).toBe(false);
  });
});
