export type BookingUrlValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

const SCHEME_REGEX = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;
const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

export function normalizeBookingUrl(input: string): string {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    throw new Error("Booking URL is required.");
  }

  const withScheme = SCHEME_REGEX.test(trimmedInput)
    ? trimmedInput
    : `https://${trimmedInput}`;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(withScheme);
  } catch {
    throw new Error("Please enter a valid URL.");
  }

  if (!HTTP_PROTOCOLS.has(parsedUrl.protocol)) {
    throw new Error("URL must start with http:// or https://.");
  }

  return parsedUrl.toString();
}

export function validateAndNormalizeBookingUrl(input: string): BookingUrlValidationResult {
  try {
    return { ok: true, value: normalizeBookingUrl(input) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Please enter a valid URL.",
    };
  }
}
