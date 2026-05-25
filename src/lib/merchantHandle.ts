import { z } from "zod";

export const RESERVED_HANDLES = new Set([
  "merchant",
  "notify",
  "claim",
  "admin",
  "api",
  "r",
  "tools",
  "consumer",
  "billing",
  "login",
  "onboarding",
  "waitlist",
  "openings",
  "analytics",
  "settings",
  "qr-code",
  "my-bookings",
  "booking-confirmed",
  "my-notifications",
]);

const HANDLE_FORMAT_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export function normalizeHandleInput(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function businessNameToHandle(name: string): string {
  return normalizeHandleInput(name).slice(0, 30);
}

export function validateMerchantHandle(value: string): { ok: true } | { ok: false; error: string } {
  const normalized = normalizeHandleInput(value);

  if (normalized.length < 3) {
    return { ok: false, error: "Handle must be at least 3 characters" };
  }

  if (normalized.length > 30) {
    return { ok: false, error: "Handle must be 30 characters or fewer" };
  }

  if (!HANDLE_FORMAT_REGEX.test(normalized)) {
    return { ok: false, error: "Use letters, numbers, and hyphens only" };
  }

  if (normalized.includes("--")) {
    return { ok: false, error: "Handle cannot contain consecutive hyphens" };
  }

  if (RESERVED_HANDLES.has(normalized)) {
    return { ok: false, error: "This handle is reserved" };
  }

  return { ok: true };
}

export const merchantHandleSchema = z
  .string()
  .transform((value) => normalizeHandleInput(value))
  .pipe(
    z
      .string()
      .min(3, "Handle must be at least 3 characters")
      .max(30, "Handle must be 30 characters or fewer")
      .regex(HANDLE_FORMAT_REGEX, "Use letters, numbers, and hyphens only")
      .refine((value) => !value.includes("--"), "Handle cannot contain consecutive hyphens")
      .refine((value) => !RESERVED_HANDLES.has(value), "This handle is reserved"),
  );
