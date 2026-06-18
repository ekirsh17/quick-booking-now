import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ParsedCancellation } from "./utils.ts";

type SupabaseClient = ReturnType<typeof createClient>;

export type StaffRecord = {
  id: string;
  name: string | null;
  location_id?: string | null;
};

export function normalizeForNameMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasWordSequence(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return ` ${haystack} `.includes(` ${needle} `);
}

export function findSingleStaffMatch(
  staff: StaffRecord[],
  normalizedSource: string
): StaffRecord | null {
  const fullMatches = staff.filter((member) => {
    const normalizedName = normalizeForNameMatch(member.name || "");
    if (!normalizedName) return false;
    return hasWordSequence(normalizedSource, normalizedName);
  });
  if (fullMatches.length === 1) return fullMatches[0];

  const firstNameMatches = staff.filter((member) => {
    const normalizedName = normalizeForNameMatch(member.name || "");
    if (!normalizedName) return false;
    const first = normalizedName.split(" ")[0];
    if (!first || first.length < 3) return false;
    return hasWordSequence(normalizedSource, first);
  });
  if (firstNameMatches.length === 1) return firstNameMatches[0];

  return null;
}

export function resolveStaffMatchFromList(
  staffWithNames: StaffRecord[],
  sourceText: string,
  staffNameHint?: string | null
): StaffRecord | null {
  const normalizedHint = normalizeForNameMatch(staffNameHint || "");
  const normalizedText = normalizeForNameMatch(sourceText);

  if (normalizedHint) {
    const hintMatch = findSingleStaffMatch(staffWithNames, normalizedHint);
    if (hintMatch) return hintMatch;
  }

  if (!normalizedText) return null;
  return findSingleStaffMatch(staffWithNames, normalizedText);
}

export function resolveSoleStaffFallbackFromList(
  staffWithNames: StaffRecord[]
): StaffRecord | null {
  if (staffWithNames.length !== 1) return null;
  return staffWithNames[0];
}

export function filterActiveStaffWithNames(staff: StaffRecord[]): StaffRecord[] {
  return staff.filter((member) => (member.name || "").trim().length > 0);
}

export async function fetchActiveStaff(
  supabase: SupabaseClient,
  merchantId: string,
  locationId: string | null
): Promise<StaffRecord[]> {
  let query = supabase
    .from("staff")
    .select("id, name, location_id")
    .eq("merchant_id", merchantId)
    .eq("active", true);

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  const { data: staff } = await query;
  if (!staff || staff.length === 0) return [];
  return staff as StaffRecord[];
}

export async function resolveOpeningStaff(
  supabase: SupabaseClient,
  merchantId: string,
  locationId: string | null,
  sourceText: string,
  staffNameHint?: string | null
): Promise<StaffRecord | null> {
  const staff = await fetchActiveStaff(supabase, merchantId, locationId);
  const staffWithNames = filterActiveStaffWithNames(staff);
  if (staffWithNames.length === 0) return null;

  const matched = resolveStaffMatchFromList(staffWithNames, sourceText, staffNameHint);
  if (matched) return matched;

  return resolveSoleStaffFallbackFromList(staffWithNames);
}

export async function resolveOpeningStaffId(
  supabase: SupabaseClient,
  merchantId: string,
  locationId: string | null,
  sourceText: string,
  staffNameHint?: string | null
): Promise<string | null> {
  const staff = await resolveOpeningStaff(
    supabase,
    merchantId,
    locationId,
    sourceText,
    staffNameHint
  );
  return staff?.id ?? null;
}

const GENERIC_CALENDAR_WORDS =
  /\b(meeting|appointment|call|event|session|booking)s?\b/i;

const DURATION_GENERIC_TITLE =
  /^\d+\s*(-?\s*)?(min(?:ute)?s?|hrs?|hours?)\b.*\b(meeting|appointment|call|event|session|booking)s?\b/i;

const ENTIRE_GENERIC_TITLE =
  /^(?:(?:\d+\s*(-?\s*)?(?:min(?:ute)?s?|hrs?|hours?)\s*)?(meeting|appointment|call|event|session|booking)s?\.?)$/i;

const CALENDAR_BOILERPLATE_PREFIX =
  /^(?:appointment\s+with\b|cancel(?:led|ed)\s*:|re:\s*appointment\b|blocked\s+time\b)/i;

const CANCELLATION_NOISE =
  /\b(?:has\s+been|was)\s+cancel(?:led|ed)\b/i;

export function isLowQualityAppointmentName(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 3) return true;
  if (/^[\d\s\W]+$/.test(trimmed)) return true;

  if (DURATION_GENERIC_TITLE.test(trimmed)) return true;
  if (ENTIRE_GENERIC_TITLE.test(trimmed)) return true;
  if (CALENDAR_BOILERPLATE_PREFIX.test(trimmed)) return true;
  if (CANCELLATION_NOISE.test(trimmed)) return true;

  if (GENERIC_CALENDAR_WORDS.test(trimmed)) {
    const withoutGeneric = trimmed
      .replace(/\d+\s*(-?\s*)?(min(?:ute)?s?|hrs?|hours?)\b/gi, "")
      .replace(GENERIC_CALENDAR_WORDS, "")
      .replace(/[^a-z0-9]+/gi, "")
      .trim();
    if (withoutGeneric.length < 3) return true;
  }

  return false;
}

export function resolveAppointmentName(
  parsed: Pick<ParsedCancellation, "appointmentName">
): string | null {
  const raw = parsed.appointmentName?.trim();
  if (!raw) return null;
  return isLowQualityAppointmentName(raw) ? null : raw;
}
