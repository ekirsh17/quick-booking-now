import { DateTime } from "https://esm.sh/luxon@3.4.4";
import {
  collectTextLines,
  extractDateToken,
  extractStaffHint,
  extractTimeRange,
  extractTimeToken,
  findLabelValue,
  parseDateAndTime,
  parseDateTimeValue,
  stripHtml,
  type ParsedCancellation,
} from "../utils.ts";

type FreshaInput = {
  fromAddress: string;
  subject: string;
  html: string;
  text: string;
  merchantTimeZone: string;
  defaultDuration: number;
};

export { type ParsedCancellation };

export function parseFreshaEmail(input: FreshaInput): ParsedCancellation[] | null {
  const { fromAddress, subject, html, text, merchantTimeZone, defaultDuration } = input;
  const normalized = `${fromAddress} ${subject} ${text} ${stripHtml(html)}`.toLowerCase();
  const hasCancelSignal = normalized.includes("cancelled") || normalized.includes("canceled");
  const hasRescheduleSignal = normalized.includes("reschedul") || normalized.includes("moved");
  const isFresha = /@[^>\s]*(fresha|shedul)\.com/i.test(fromAddress) ||
    normalized.includes("fresha") ||
    normalized.includes("shedul");

  if ((!hasCancelSignal && !hasRescheduleSignal) || !isFresha) return null;

  const lines = collectTextLines(html, text);
  const lineText = lines.join("\n");
  const service = findLabelValue(lines, ["Service", "Appointment Type", "Treatment"]);
  const staff = findLabelValue(lines, ["Provider", "Staff", "Therapist", "With"]) || extractStaffHint(lineText);
  const dateValue = findLabelValue(lines, ["Date", "Appointment Date"]);
  const timeValue = findLabelValue(lines, ["Time", "Appointment Time"]);
  const dateTimeValue = findLabelValue(lines, ["Date/Time", "Date Time"]);

  const htmlParsed = parseStructuredDateTime(dateValue, timeValue, dateTimeValue, merchantTimeZone, defaultDuration);
  if (htmlParsed) {
    return [{
      startTimeUtc: htmlParsed.start.toUTC().startOf("minute").toISO() || "",
      endTimeUtc: htmlParsed.end.toUTC().startOf("minute").toISO() || "",
      appointmentName: service || null,
      staffName: staff || null,
      confidence: 1,
      provider: "fresha",
      source: "fresha_html",
      durationMinutes: htmlParsed.durationMinutes,
      durationSource: htmlParsed.durationSource,
    }];
  }

  const subjectDate = extractDateToken(subject);
  const subjectTime = extractTimeToken(subject);
  const subjectStart = parseDateAndTime(subjectDate, subjectTime, merchantTimeZone);
  if (subjectStart) {
    const end = subjectStart.plus({ minutes: defaultDuration });
    return [{
      startTimeUtc: subjectStart.toUTC().startOf("minute").toISO() || "",
      endTimeUtc: end.toUTC().startOf("minute").toISO() || "",
      appointmentName: service || null,
      staffName: staff || null,
      confidence: 1,
      provider: "fresha",
      source: "fresha_subject",
      durationMinutes: defaultDuration,
      durationSource: "default",
    }];
  }

  const plainText = `${text}\n${stripHtml(html)}`;
  const plainDate = extractDateToken(plainText);
  const plainTime = extractTimeToken(plainText);
  const plainStart = parseDateAndTime(plainDate, plainTime, merchantTimeZone);
  if (plainStart) {
    const range = extractTimeRange(plainText);
    const plainEnd = range?.end
      ? parseDateAndTime(plainDate, range.end, merchantTimeZone)
      : plainStart.plus({ minutes: defaultDuration });
    const end = plainEnd && plainEnd > plainStart ? plainEnd : plainStart.plus({ minutes: defaultDuration });
    return [{
      startTimeUtc: plainStart.toUTC().startOf("minute").toISO() || "",
      endTimeUtc: end.toUTC().startOf("minute").toISO() || "",
      appointmentName: service || null,
      staffName: staff || extractStaffHint(plainText),
      confidence: 1,
      provider: "fresha",
      source: "fresha_text",
      durationMinutes: Math.max(5, Math.round(end.diff(plainStart, "minutes").minutes)),
      durationSource: range ? "range" : "default",
    }];
  }

  return [];
}

function parseStructuredDateTime(
  dateValue: string | null,
  timeValue: string | null,
  dateTimeValue: string | null,
  zone: string,
  defaultDuration: number
): { start: DateTime; end: DateTime; durationMinutes: number; durationSource: string } | null {
  if (dateTimeValue) {
    const start = parseDateTimeValue(dateTimeValue, zone);
    if (start) {
      const range = extractTimeRange(dateTimeValue);
      const dateToken = extractDateToken(dateTimeValue) || dateValue;
      const end = range?.end
        ? parseDateAndTime(dateToken, range.end, zone)
        : start.plus({ minutes: defaultDuration });
      const resolvedEnd = end && end > start ? end : start.plus({ minutes: defaultDuration });
      return {
        start,
        end: resolvedEnd,
        durationMinutes: Math.max(5, Math.round(resolvedEnd.diff(start, "minutes").minutes)),
        durationSource: range ? "range" : "default",
      };
    }
  }

  const start = parseDateAndTime(dateValue, timeValue, zone);
  if (!start) return null;
  const range = extractTimeRange(timeValue || "");
  const end = range?.end
    ? parseDateAndTime(dateValue, range.end, zone)
    : start.plus({ minutes: defaultDuration });
  const resolvedEnd = end && end > start ? end : start.plus({ minutes: defaultDuration });
  return {
    start,
    end: resolvedEnd,
    durationMinutes: Math.max(5, Math.round(resolvedEnd.diff(start, "minutes").minutes)),
    durationSource: range ? "range" : "default",
  };
}
