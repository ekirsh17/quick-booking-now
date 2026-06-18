export type BookingConfirmedScenario = 1 | 2 | 3 | 4;

export function resolveBookingConfirmedScenario(
  useBookingSystem: boolean,
  requireConfirmation: boolean,
): BookingConfirmedScenario {
  if (useBookingSystem) {
    return 2;
  }
  if (requireConfirmation) {
    return 3;
  }
  return 4;
}

export function shouldShowBookingSuccessConfetti(
  scenario: BookingConfirmedScenario,
  slotStatus: string,
): boolean {
  return scenario === 4 || (scenario === 3 && slotStatus === "booked");
}
