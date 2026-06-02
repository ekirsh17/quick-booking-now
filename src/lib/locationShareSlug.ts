const LOCATION_SLUG_FORMAT_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export function normalizeLocationShareSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function validateLocationShareSlug(value: string): { ok: true } | { ok: false; error: string } {
  const normalized = normalizeLocationShareSlug(value);

  if (normalized.length < 2) {
    return { ok: false, error: "Location link must be at least 2 characters" };
  }

  if (normalized.length > 40) {
    return { ok: false, error: "Location link must be 40 characters or fewer" };
  }

  if (!LOCATION_SLUG_FORMAT_REGEX.test(normalized)) {
    return { ok: false, error: "Use letters, numbers, and hyphens only" };
  }

  if (normalized.includes("--")) {
    return { ok: false, error: "Location link cannot contain consecutive hyphens" };
  }

  return { ok: true };
}
