import { DateTime } from "https://esm.sh/luxon@3.4.4";

export type ParsedCancellation = {
  startTimeUtc: string;
  endTimeUtc: string;
  appointmentName?: string | null;
  staffName?: string | null;
  confidence: number;
  provider?: string | null;
  source?: string | null;
  durationMinutes?: number | null;
  durationSource?: string | null;
};

export type Attachment = {
  Name?: string;
  ContentType?: string;
  Content?: string;
};

type ParsedIcsCancellation = {
  start: DateTime;
  end: DateTime;
  appointmentName: string | null;
  staffName: string | null;
  durationMinutes: number;
};

export function stripHtml(html: string): string {
  if (!html) return "";
  return decodeHtmlEntities(
    html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export function htmlToTextLines(html: string): string[] {
  if (!html) return [];
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|td|li|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<(p|div|tr|td|li|h1|h2|h3|h4|h5|h6)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(withBreaks)
    .split(/\n+/)
    .map(normalizeWhitespace)
    .filter(Boolean);
}

export function textToLines(text: string): string[] {
  if (!text) return [];
  return decodeHtmlEntities(text)
    .split(/\n+/)
    .map(normalizeWhitespace)
    .filter(Boolean);
}

export function collectTextLines(html: string, text: string): string[] {
  const combined = [...htmlToTextLines(html), ...textToLines(text)];
  const deduped = new Set<string>();
  for (const line of combined) {
    if (!line) continue;
    deduped.add(line);
  }
  return [...deduped];
}

export function findLabelValue(lines: string[], labels: string[]): string | null {
  const escaped = labels.map(escapeRegExp).join("|");
  const direct = new RegExp(`(?:^|\\b)(?:${escaped})\\s*[:\\-]\\s*(.+)$`, "i");
  const soft = new RegExp(`^(?:${escaped})\\s+(.+)$`, "i");
  const equals = new RegExp(`^(?:${escaped})\\s*:?$`, "i");

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const directMatch = line.match(direct);
    if (directMatch?.[1]) {
      return cleanFieldValue(directMatch[1]);
    }

    const softMatch = line.match(soft);
    if (softMatch?.[1]) {
      return cleanFieldValue(softMatch[1]);
    }

    if (equals.test(line) && i + 1 < lines.length) {
      const next = cleanFieldValue(lines[i + 1]);
      if (next) return next;
    }
  }

  return null;
}

export function parseDateTimeValue(
  value: string | null | undefined,
  zone: string,
  baseDate: DateTime | null = null
): DateTime | null {
  if (!value) return null;
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;

  const zoneOverride = resolveTimezoneOverride(normalized) || zone;
  const cleaned = stripTimezone(normalized);
  const direct = parseWithFormats(cleaned, zoneOverride, baseDate);
  if (direct) return direct;

  const dateToken = extractDateToken(cleaned);
  const timeToken = extractTimeToken(cleaned);
  if (dateToken && timeToken) {
    const combined = `${normalizeWhitespace(dateToken)} ${normalizeWhitespace(stripTimezone(timeToken))}`;
    return parseWithFormats(combined, resolveTimezoneOverride(timeToken) || zoneOverride, baseDate);
  }

  return null;
}

export function parseDateAndTime(
  dateText: string | null | undefined,
  timeText: string | null | undefined,
  zone: string,
  baseDate: DateTime | null = null
): DateTime | null {
  if (!dateText || !timeText) return null;
  const combined = `${normalizeWhitespace(dateText)} ${normalizeWhitespace(stripTimezone(timeText))}`;
  return parseWithFormats(combined, resolveTimezoneOverride(timeText) || zone, baseDate);
}

export function extractDateToken(text: string): string | null {
  const iso = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (iso) return iso[0];

  const us = text.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/);
  if (us) return us[0];

  const long = text.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?\.?,?\s*(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Sept(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/i);
  if (long) return long[0];

  return null;
}

export function extractTimeToken(text: string): string | null {
  const match = text.match(/\b(\d{1,2}(?::\d{2})?\s*(?:AM|PM|A\.?M\.?|P\.?M\.?)|(?:[01]?\d|2[0-3]):[0-5]\d)(?:\s*(?:ET|EST|EDT|CT|CST|CDT|MT|MST|MDT|PT|PST|PDT))?\b/i);
  return match?.[0] || null;
}

export function extractTimeRange(text: string): { start: string; end: string } | null {
  const match = text.match(
    /\b(\d{1,2}(?::\d{2})?\s*(?:AM|PM|A\.?M\.?|P\.?M\.?)|(?:[01]?\d|2[0-3]):[0-5]\d)(?:\s*(?:ET|EST|EDT|CT|CST|CDT|MT|MST|MDT|PT|PST|PDT))?\s*(?:-|to|–)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|A\.?M\.?|P\.?M\.?)|(?:[01]?\d|2[0-3]):[0-5]\d)(?:\s*(?:ET|EST|EDT|CT|CST|CDT|MT|MST|MDT|PT|PST|PDT))?\b/i
  );
  if (!match) return null;
  return { start: match[1], end: match[2] };
}

export function extractStaffHint(text: string): string | null {
  const patterns = [
    /\bwith\s+([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,2})\b/i,
    /\bprovider\s*:\s*([^\n,|;]+)/i,
    /\bstaff(?:\s+member)?\s*:\s*([^\n,|;]+)/i,
    /\bstylist\s*:\s*([^\n,|;]+)/i,
    /\btherapist\s*:\s*([^\n,|;]+)/i,
    /\btechnician\s*:\s*([^\n,|;]+)/i,
    /\bcalendar\s*:\s*([^\n,|;]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = cleanFieldValue(match?.[1] || "");
    if (isLikelyName(candidate)) return candidate;
  }

  return null;
}

export function parseCancellationFromIcs(
  attachments: Attachment[] | null | undefined,
  defaultZone: string
): ParsedIcsCancellation | null {
  if (!attachments || attachments.length === 0) return null;

  const icsAttachment = attachments.find((attachment) => {
    const contentType = attachment.ContentType?.toLowerCase() || "";
    const name = attachment.Name?.toLowerCase() || "";
    return contentType.includes("text/calendar") || name.endsWith(".ics");
  });
  if (!icsAttachment?.Content) return null;

  const content = decodeBase64(icsAttachment.Content);
  const lines = unfoldIcsLines(content);
  const fields = parseIcsFields(lines);
  const method = fields.METHOD?.toUpperCase() || "";
  const status = fields.STATUS?.toUpperCase() || "";
  if (method !== "CANCEL" && status !== "CANCELLED") return null;

  const start = parseIcsDate(fields.DTSTART, defaultZone);
  const end = parseIcsDate(fields.DTEND, defaultZone);
  if (!start || !end) return null;

  const summary = fields.SUMMARY ? decodeIcsText(fields.SUMMARY) : "";
  const description = fields.DESCRIPTION ? decodeIcsText(fields.DESCRIPTION) : "";
  const joined = `${summary}\n${description}`.trim();

  const appointmentName = extractAppointmentFromSummary(summary);
  const staffName = extractStaffHint(joined);
  const durationMinutes = Math.max(5, Math.round(end.diff(start, "minutes").minutes));

  return { start, end, appointmentName, staffName, durationMinutes };
}

function parseIcsDate(value?: string, defaultZone = "UTC"): DateTime | null {
  if (!value) return null;
  const cleaned = value.trim();
  if (cleaned.endsWith("Z")) {
    const utc = DateTime.fromFormat(cleaned, "yyyyMMdd'T'HHmmss'Z'", { zone: "utc" });
    return utc.isValid ? utc : null;
  }

  const local = DateTime.fromFormat(cleaned, "yyyyMMdd'T'HHmmss", { zone: defaultZone });
  return local.isValid ? local : null;
}

function parseIcsFields(lines: string[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    if (!rawKey || rest.length === 0) continue;
    const key = rawKey.split(";")[0].toUpperCase();
    fields[key] = rest.join(":").trim();
  }
  return fields;
}

function unfoldIcsLines(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const unfolded: string[] = [];
  for (const line of lines) {
    if (!line) continue;
    if (/^[ \t]/.test(line) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.trim();
    } else {
      unfolded.push(line.trim());
    }
  }
  return unfolded;
}

function decodeBase64(data: string): string {
  const binary = atob(data);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function decodeIcsText(value: string): string {
  return value
    .replace(/\\n/g, " ")
    .replace(/\\,/g, ",")
    .replace(/\\\\/g, "\\")
    .trim();
}

function extractAppointmentFromSummary(summary: string): string | null {
  if (!summary) return null;
  const forMatch = summary.match(/\bfor\s+(.+)$/i);
  if (forMatch?.[1]) return cleanFieldValue(forMatch[1]);
  return cleanFieldValue(summary);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseWithFormats(value: string, zone: string, baseDate: DateTime | null): DateTime | null {
  const formats = [
    "yyyy-MM-dd h:mm a",
    "yyyy-MM-dd h a",
    "yyyy-MM-dd HH:mm",
    "M/d/yyyy h:mm a",
    "M/d/yyyy h a",
    "M/d/yyyy HH:mm",
    "M/d/yy h:mm a",
    "M/d/yy h a",
    "M/d/yy HH:mm",
    "MMMM d, yyyy h:mm a",
    "MMM d, yyyy h:mm a",
    "MMMM d, yyyy h a",
    "MMM d, yyyy h a",
    "MMMM d, yyyy HH:mm",
    "MMM d, yyyy HH:mm",
    "MMMM d h:mm a",
    "MMM d h:mm a",
    "MMMM d h a",
    "MMM d h a",
    "cccc, MMMM d, yyyy h:mm a",
    "cccc, MMMM dd, yyyy h:mm a",
    "ccc, MMM d, yyyy h:mm a",
    "EEEE, MMMM d, yyyy h:mm a",
    "EEEE, MMM d, yyyy h:mm a",
  ];

  for (const format of formats) {
    const parsed = DateTime.fromFormat(value, format, { zone });
    if (parsed.isValid) return normalizeYear(parsed, baseDate);
  }

  return null;
}

function cleanFieldValue(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/\s*\|\s*$/, "")
      .replace(/^[-:]\s*/, "")
      .replace(/\s*[\u2013-]\s*$/, "")
      .trim()
  );
}

function normalizeYear(dt: DateTime, baseDate: DateTime | null = null): DateTime {
  const reference = baseDate || DateTime.now().setZone(dt.zoneName);
  if (dt.year < 2000) {
    return dt.set({ year: reference.year });
  }
  if (dt < reference.minus({ days: 1 })) {
    return dt.plus({ years: 1 });
  }
  return dt;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

function resolveTimezoneOverride(text: string): string | null {
  const match = text.match(/\b(ET|EST|EDT|CT|CST|CDT|MT|MST|MDT|PT|PST|PDT)\b/i);
  if (!match) return null;
  const map: Record<string, string> = {
    ET: "America/New_York",
    EST: "America/New_York",
    EDT: "America/New_York",
    CT: "America/Chicago",
    CST: "America/Chicago",
    CDT: "America/Chicago",
    MT: "America/Denver",
    MST: "America/Denver",
    MDT: "America/Denver",
    PT: "America/Los_Angeles",
    PST: "America/Los_Angeles",
    PDT: "America/Los_Angeles",
  };
  return map[match[1].toUpperCase()] || null;
}

function stripTimezone(text: string): string {
  return text.replace(/\b(ET|EST|EDT|CT|CST|CDT|MT|MST|MDT|PT|PST|PDT)\b/gi, "").trim();
}

function isLikelyName(value: string): boolean {
  const cleaned = cleanFieldValue(value);
  if (cleaned.length < 2) return false;
  if (/\d/.test(cleaned)) return false;
  if (/\b(mon|tue|wed|thu|fri|sat|sun|today|tomorrow)\b/i.test(cleaned)) return false;
  if (/\b(am|pm)\b/i.test(cleaned)) return false;
  return true;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
