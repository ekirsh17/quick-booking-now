import { DateTime } from "https://esm.sh/luxon@3.4.4";

type Attachment = {
  Name?: string;
  ContentType?: string;
  Content?: string;
};

export type ParsedCancellation = {
  startTimeUtc: string;
  endTimeUtc: string;
  appointmentName?: string | null;
  confidence: number;
  provider?: string | null;
  source?: string | null;
  durationMinutes?: number | null;
  durationSource?: string | null;
};

type SetmoreInput = {
  subject: string;
  html: string;
  text: string;
  attachments?: Attachment[] | null;
  merchantTimeZone: string;
  defaultDuration: number;
  baseDate: DateTime | null;
};

const TZ_MAP: Record<string, string> = {
  EST: 'America/New_York',
  EDT: 'America/New_York',
};

export function parseSetmoreEmail(input: SetmoreInput): ParsedCancellation[] | null {
  const { subject, html, text, attachments, merchantTimeZone } = input;
  const isReschedule = /appointment rescheduled/i.test(subject) || /appointment rescheduled/i.test(html);
  const isCancel = /appointment canceled|appointment cancelled/i.test(subject) || /appointment canceled|appointment cancelled/i.test(html);

  if (!isReschedule && !isCancel) return null;

  const appointmentName = extractAppointmentName(html, attachments) || null;

  if (isReschedule) {
    const old = extractOldTimeFromHtml(html, merchantTimeZone);
    if (!old) return null;
    return [{
      startTimeUtc: old.start.toUTC().toISO() || '',
      endTimeUtc: old.end.toUTC().toISO() || '',
      appointmentName,
      confidence: 1,
      provider: 'setmore',
      source: 'setmore_reschedule_old',
      durationMinutes: old.durationMinutes,
      durationSource: old.durationSource,
    }];
  }

  const ics = parseCancellationFromIcs(attachments);
  if (ics) {
    return [{
      startTimeUtc: ics.start.toUTC().toISO() || '',
      endTimeUtc: ics.end.toUTC().toISO() || '',
      appointmentName: ics.appointmentName || appointmentName,
      confidence: 1,
      provider: 'setmore',
      source: 'setmore_ics',
      durationMinutes: ics.durationMinutes,
      durationSource: 'range',
    }];
  }

  const htmlParsed = extractOldTimeFromHtml(html, merchantTimeZone);
  if (htmlParsed) {
    return [{
      startTimeUtc: htmlParsed.start.toUTC().toISO() || '',
      endTimeUtc: htmlParsed.end.toUTC().toISO() || '',
      appointmentName,
      confidence: 1,
      provider: 'setmore',
      source: 'setmore_html',
      durationMinutes: htmlParsed.durationMinutes,
      durationSource: htmlParsed.durationSource,
    }];
  }

  const subjectParsed = parseSubjectCancellation(subject, merchantTimeZone, input.defaultDuration);
  if (subjectParsed) {
    return [{
      startTimeUtc: subjectParsed.start.toUTC().toISO() || '',
      endTimeUtc: subjectParsed.end.toUTC().toISO() || '',
      appointmentName,
      confidence: 1,
      provider: 'setmore',
      source: 'setmore_subject',
      durationMinutes: subjectParsed.durationMinutes,
      durationSource: subjectParsed.durationSource,
    }];
  }

  return null;
}

function extractAppointmentName(html: string, attachments?: Attachment[] | null): string | null {
  const match = html.match(/>What<\/p>\s*<p[^>]*>([^<]+)<\/p>/i);
  if (match?.[1]) {
    return decodeHtmlEntities(match[1].trim());
  }

  const ics = parseCancellationFromIcs(attachments);
  if (ics?.appointmentName) return ics.appointmentName;

  return null;
}

function parseSubjectCancellation(subject: string, zone: string, defaultDuration: number) {
  const match = subject.match(/Appointment canceled:\s+([A-Za-z]{3})\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM))\s*\(([^)]+)\)/i);
  if (!match) return null;

  const dateText = `${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
  const timeText = match[5];
  const tz = match[6]?.toUpperCase();
  const resolvedZone = TZ_MAP[tz] || zone;

  const start = parseDateTime(dateText, timeText, resolvedZone);
  if (!start) return null;
  const end = start.plus({ minutes: defaultDuration });

  return { start, end, durationMinutes: defaultDuration, durationSource: 'default' };
}

function extractOldTimeFromHtml(html: string, zone: string) {
  const strikes = [...html.matchAll(/<s>([^<]+)<\/s>/gi)].map((match) => decodeHtmlEntities(match[1].trim()));
  if (strikes.length === 0) return null;

  const dateText = strikes.find((value) => /\b[A-Za-z]{3}\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\b/.test(value));
  const timeText = strikes.find((value) => /\d{1,2}:\d{2}\s*(AM|PM)/i.test(value));
  if (!dateText || !timeText) return null;

  const rangeMatch = timeText.match(/(.+?)\s*-\s*(.+?)(?:\s*\(([^)]+)\))?$/);
  if (!rangeMatch) return null;

  const startText = rangeMatch[1].trim();
  const endText = rangeMatch[2].trim();
  const tzText = rangeMatch[3]?.toUpperCase();
  const resolvedZone = tzText ? (TZ_MAP[tzText] || zone) : zone;

  const start = parseDateTime(dateText, startText, resolvedZone);
  const end = parseDateTime(dateText, endText, resolvedZone);
  if (!start || !end) return null;

  const durationMinutes = Math.max(5, Math.round(end.diff(start, 'minutes').minutes));

  return {
    start,
    end,
    durationMinutes,
    durationSource: 'range',
  };
}

function parseCancellationFromIcs(attachments?: Attachment[] | null) {
  if (!attachments || attachments.length === 0) return null;

  const icsAttachment = attachments.find((attachment) => {
    const contentType = attachment.ContentType?.toLowerCase() || '';
    const name = attachment.Name?.toLowerCase() || '';
    return contentType.includes('text/calendar') || name.endsWith('.ics');
  });

  if (!icsAttachment?.Content) return null;

  const content = decodeBase64(icsAttachment.Content);
  const lines = unfoldIcsLines(content);
  const fields = parseIcsFields(lines);

  const method = fields.METHOD?.toUpperCase();
  const status = fields.STATUS?.toUpperCase();
  if (method !== 'CANCEL' && status !== 'CANCELLED') return null;

  const start = parseIcsDate(fields.DTSTART);
  const end = parseIcsDate(fields.DTEND);
  if (!start || !end) return null;

  const durationMinutes = Math.max(5, Math.round(end.diff(start, 'minutes').minutes));
  const summary = fields.SUMMARY ? decodeIcsText(fields.SUMMARY) : null;
  const appointmentName = summary ? extractServiceFromSummary(summary) : null;

  return { start, end, durationMinutes, appointmentName };
}

function parseIcsDate(value?: string): DateTime | null {
  if (!value) return null;
  const cleaned = value.trim();
  if (cleaned.endsWith('Z')) {
    const dt = DateTime.fromFormat(cleaned, "yyyyMMdd'T'HHmmss'Z'", { zone: 'utc' });
    return dt.isValid ? dt : null;
  }
  const dt = DateTime.fromFormat(cleaned, "yyyyMMdd'T'HHmmss");
  return dt.isValid ? dt : null;
}

function parseIcsFields(lines: string[]) {
  const fields: Record<string, string> = {};
  for (const line of lines) {
    const [rawKey, ...rest] = line.split(':');
    if (!rawKey || rest.length === 0) continue;
    const key = rawKey.split(';')[0].toUpperCase();
    fields[key] = rest.join(':').trim();
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
  return value.replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\\\/g, '\\').trim();
}

function extractServiceFromSummary(summary: string): string {
  const parts = summary.split(' for ');
  if (parts.length > 1) {
    return parts.slice(1).join(' for ').trim();
  }
  return summary.trim();
}

function parseDateTime(dateText: string, timeText: string, zone: string): DateTime | null {
  const formats = ['ccc d LLL yyyy h:mm a', 'ccc dd LLL yyyy h:mm a', 'ccc d LLL yyyy h a', 'ccc dd LLL yyyy h a'];
  const cleanedDate = dateText.replace(/\s+/g, ' ').trim();
  const cleanedTime = timeText.replace(/\s+/g, ' ').trim();
  const combined = `${cleanedDate} ${cleanedTime}`;

  for (const format of formats) {
    const dt = DateTime.fromFormat(combined, format, { zone });
    if (dt.isValid) return dt;
  }
  return null;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#x27;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim();
}
