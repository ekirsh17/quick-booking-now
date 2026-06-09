import { DateTime } from "https://esm.sh/luxon@3.4.4";
import {
  collectTextLines,
  extractDateToken,
  extractStaffHint,
  extractTimeRange,
  extractTimeToken,
  findLabelValue,
  parseDateAndTime,
  parseStructuredDateTime,
  stripHtml,
  type ParsedCancellation,
} from "../utils.ts";

type GlossGeniusInput = {
  fromAddress: string;
  subject: string;
  html: string;
  text: string;
  merchantTimeZone: string;
  defaultDuration: number;
  baseDate: DateTime | null;
};

export { type ParsedCancellation };

export function parseGlossGeniusEmail(input: GlossGeniusInput): ParsedCancellation[] | null {
  const { fromAddress, subject, html, text, merchantTimeZone, defaultDuration, baseDate } = input;
  const normalized = `${fromAddress} ${subject} ${text} ${stripHtml(html)}`.toLowerCase();
  const hasCancelSignal = normalized.includes("cancelled") || normalized.includes("canceled");
  const hasRescheduleSignal = normalized.includes("reschedul") || normalized.includes("moved");
  const isGlossGenius = /@[^>\s]*(glossgenius|mg\.glossgenius)\.com/i.test(fromAddress) ||
    normalized.includes("glossgenius");

  if ((!hasCancelSignal && !hasRescheduleSignal) || !isGlossGenius) return null;

  const lines = collectTextLines(html, text);
  const lineText = lines.join("\n");
  const service = findLabelValue(lines, ["Service", "Appointment Type", "Appointment"]);
  const staff = findLabelValue(lines, ["Provider", "Staff", "With"]) || extractStaffHint(lineText);
  const dateValue = findLabelValue(lines, ["Date", "Appointment Date"]);
  const timeValue = findLabelValue(lines, ["Time", "Appointment Time"]);
  const dateTimeValue = findLabelValue(lines, ["Date/Time", "Date Time"]);

  const htmlParsed = parseStructuredDateTime(dateValue, timeValue, dateTimeValue, merchantTimeZone, defaultDuration, baseDate);
  if (htmlParsed) {
    return [{
      startTimeUtc: htmlParsed.start.toUTC().startOf("minute").toISO() || "",
      endTimeUtc: htmlParsed.end.toUTC().startOf("minute").toISO() || "",
      appointmentName: service || null,
      staffName: staff || null,
      confidence: 1,
      provider: "glossgenius",
      source: "glossgenius_html",
      durationMinutes: htmlParsed.durationMinutes,
      durationSource: htmlParsed.durationSource,
    }];
  }

  const subjectDate = extractDateToken(subject);
  const subjectTime = extractTimeToken(subject);
  const subjectStart = parseDateAndTime(subjectDate, subjectTime, merchantTimeZone, baseDate);
  if (subjectStart) {
    const subjectRange = extractTimeRange(subject);
    const subjectEnd = subjectRange?.end
      ? parseDateAndTime(subjectDate, subjectRange.end, merchantTimeZone, baseDate)
      : subjectStart.plus({ minutes: defaultDuration });
    const end = subjectEnd && subjectEnd > subjectStart ? subjectEnd : subjectStart.plus({ minutes: defaultDuration });
    return [{
      startTimeUtc: subjectStart.toUTC().startOf("minute").toISO() || "",
      endTimeUtc: end.toUTC().startOf("minute").toISO() || "",
      appointmentName: service || null,
      staffName: staff || null,
      confidence: 1,
      provider: "glossgenius",
      source: "glossgenius_subject",
      durationMinutes: Math.max(5, Math.round(end.diff(subjectStart, "minutes").minutes)),
      durationSource: subjectRange ? "range" : "default",
    }];
  }

  const plainText = `${text}\n${stripHtml(html)}`;
  const plainDate = extractDateToken(plainText);
  const plainTime = extractTimeToken(plainText);
  const plainStart = parseDateAndTime(plainDate, plainTime, merchantTimeZone, baseDate);
  if (plainStart) {
    const range = extractTimeRange(plainText);
    const plainEnd = range?.end
      ? parseDateAndTime(plainDate, range.end, merchantTimeZone, baseDate)
      : plainStart.plus({ minutes: defaultDuration });
    const end = plainEnd && plainEnd > plainStart ? plainEnd : plainStart.plus({ minutes: defaultDuration });
    return [{
      startTimeUtc: plainStart.toUTC().startOf("minute").toISO() || "",
      endTimeUtc: end.toUTC().startOf("minute").toISO() || "",
      appointmentName: service || null,
      staffName: staff || extractStaffHint(plainText),
      confidence: 1,
      provider: "glossgenius",
      source: "glossgenius_text",
      durationMinutes: Math.max(5, Math.round(end.diff(plainStart, "minutes").minutes)),
      durationSource: range ? "range" : "default",
    }];
  }

  return null;
}
