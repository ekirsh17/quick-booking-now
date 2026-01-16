import { DateTime } from "https://esm.sh/luxon@3.4.4";

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

type BooksyInput = {
  subject: string;
  html: string;
  text: string;
  merchantTimeZone: string;
  defaultDuration: number;
};

export function parseBooksyEmail(input: BooksyInput): ParsedCancellation[] | null {
  const { subject, html, text, merchantTimeZone, defaultDuration } = input;
  const combined = `${subject} ${text} ${stripHtml(html)}`.trim();
  const isReschedule = /rescheduled their appointment|changed his\/her booking/i.test(combined);
  const isCancel = /cancelled appointment|canceled appointment|cancelled\s+appointment/i.test(combined);

  if (!isCancel && !isReschedule) return null;

  const appointmentName = extractAppointmentName(html, text);

  if (isReschedule) {
    const newRange = extractDateRange(text, merchantTimeZone) || extractDateRange(html, merchantTimeZone);
    const durationOverride = newRange
      ? Math.max(5, Math.round(newRange.end.diff(newRange.start, 'minutes').minutes))
      : defaultDuration;
    const previous = extractPreviousAppointment(text, merchantTimeZone, durationOverride)
      || extractPreviousAppointment(stripHtml(html), merchantTimeZone, durationOverride);
    if (previous) {
      return [{
        startTimeUtc: previous.start.toUTC().toISO() || '',
        endTimeUtc: previous.end.toUTC().toISO() || '',
        appointmentName,
        confidence: 1,
        provider: 'booksy',
        source: 'booksy_reschedule_previous',
        durationMinutes: durationOverride,
        durationSource: 'default',
      }];
    }
    return [];
  }

  if (!isCancel) return null;

  const range = extractDateRange(text, merchantTimeZone) || extractDateRange(html, merchantTimeZone);
  if (range) {
    return [{
      startTimeUtc: range.start.toUTC().toISO() || '',
      endTimeUtc: range.end.toUTC().toISO() || '',
      appointmentName,
      confidence: 1,
      provider: 'booksy',
      source: 'booksy_range',
      durationMinutes: Math.max(5, Math.round(range.end.diff(range.start, 'minutes').minutes)),
      durationSource: 'range',
    }];
  }

  const subjectParsed = parseSubjectDateTime(subject, merchantTimeZone);
  if (subjectParsed) {
    const end = subjectParsed.plus({ minutes: defaultDuration });
    return [{
      startTimeUtc: subjectParsed.toUTC().toISO() || '',
      endTimeUtc: end.toUTC().toISO() || '',
      appointmentName,
      confidence: 1,
      provider: 'booksy',
      source: 'booksy_subject',
      durationMinutes: defaultDuration,
      durationSource: 'default',
    }];
  }

  return null;
}

function extractAppointmentName(html: string, text: string): string | null {
  const htmlMatch = html.match(/cancelled appointment for\s*<b[^>]*>\s*([^<]+)\s*<\/b>/i)
    || html.match(/rescheduled their appointment for\s*<b[^>]*>\s*([^<]+)\s*<\/b>/i);
  if (htmlMatch?.[1]) {
    return decodeHtmlEntities(htmlMatch[1].trim());
  }

  const textMatch = text.match(/cancelled appointment for\s*([^\n]+?)\s*on:/i)
    || text.match(/rescheduled their appointment for\s*([^\n]+?)\s*to another time/i);
  if (textMatch?.[1]) {
    return textMatch[1].trim();
  }

  return null;
}

function extractDateRange(source: string, zone: string): { start: DateTime; end: DateTime } | null {
  const cleaned = stripHtml(source);
  const match = cleaned.match(/([A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}),\s*(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
  if (!match) return null;

  const dateText = match[1];
  const startTime = match[2];
  const endTime = match[3];

  const start = parseDateTime(dateText, startTime, zone);
  const end = parseDateTime(dateText, endTime, zone);
  if (!start || !end) return null;

  return { start, end };
}

function parseSubjectDateTime(subject: string, zone: string): DateTime | null {
  const match = subject.match(/cancelled appointment on:\s*([A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
  if (!match) return null;
  return parseDateTime(match[1], match[2], zone);
}

function extractPreviousAppointment(source: string, zone: string, durationMinutes: number): { start: DateTime; end: DateTime } | null {
  const match = source.match(/Previous appointment date:\s*([A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})\s+at:\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
  if (!match) return null;
  const start = parseDateTime(match[1], match[2], zone);
  if (!start) return null;
  return { start, end: start.plus({ minutes: durationMinutes }) };
}

function parseDateTime(dateText: string, timeText: string, zone: string): DateTime | null {
  const formats = [
    'cccc, MMMM d, yyyy h:mm a',
    'cccc, MMMM dd, yyyy h:mm a',
  ];
  const cleanedDate = dateText.replace(/\s+/g, ' ').trim();
  const cleanedTime = timeText.replace(/\s+/g, ' ').trim();
  const combined = `${cleanedDate} ${cleanedTime}`;

  for (const format of formats) {
    const dt = DateTime.fromFormat(combined, format, { zone });
    if (dt.isValid) return dt;
  }
  return null;
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
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
