import { DateTime } from "https://esm.sh/luxon@3.4.4";
import {
  collectTextLines,
  extractDateToken,
  extractStaffHint,
  extractTimeRange,
  findLabelValue,
  parseCancellationFromIcs,
  parseDateAndTime,
  parseDateTimeValue,
  stripHtml,
  type Attachment,
  type ParsedCancellation,
} from "../utils.ts";

type AcuityInput = {
  fromAddress: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Attachment[] | null;
  merchantTimeZone: string;
  defaultDuration: number;
};

export { type ParsedCancellation };

export function parseAcuityEmail(input: AcuityInput): ParsedCancellation[] | null {
  const { fromAddress, subject, html, text, attachments, merchantTimeZone, defaultDuration } = input;
  const normalized = `${fromAddress} ${subject} ${text} ${stripHtml(html)}`.toLowerCase();
  const hasCancelSignal = normalized.includes("cancelled") || normalized.includes("canceled");
  const hasRescheduleSignal = normalized.includes("reschedul") || normalized.includes("moved");
  const isAcuity = /@[^>\s]*(acuityscheduling|squarespacemail)\.com/i.test(fromAddress) ||
    normalized.includes("acuity scheduling") ||
    normalized.includes("acuityscheduling") ||
    normalized.includes("squarespacemail");

  if ((!hasCancelSignal && !hasRescheduleSignal) || !isAcuity) return null;

  const lines = collectTextLines(html, text);
  const lineText = lines.join("\n");
  const appointmentName = findLabelValue(lines, ["Appointment Type", "Type", "Service", "Appointment"]);
  const staffName = findLabelValue(lines, ["Calendar", "Provider", "Staff", "With"]) || extractStaffHint(lineText);
  const dateTimeValue = findLabelValue(lines, ["Date/Time", "Date Time"]);
  const dateValue = findLabelValue(lines, ["Date", "Appointment Date"]);
  const timeValue = findLabelValue(lines, ["Time", "Appointment Time"]);

  const htmlParsed = parseStructuredDateTime(dateValue, timeValue, dateTimeValue, merchantTimeZone, defaultDuration);
  if (htmlParsed) {
    return [{
      startTimeUtc: htmlParsed.start.toUTC().startOf("minute").toISO() || "",
      endTimeUtc: htmlParsed.end.toUTC().startOf("minute").toISO() || "",
      appointmentName: appointmentName || null,
      staffName: staffName || null,
      confidence: 1,
      provider: "acuity",
      source: "acuity_html",
      durationMinutes: htmlParsed.durationMinutes,
      durationSource: htmlParsed.durationSource,
    }];
  }

  const ics = parseCancellationFromIcs(attachments, merchantTimeZone);
  if (ics) {
    return [{
      startTimeUtc: ics.start.toUTC().startOf("minute").toISO() || "",
      endTimeUtc: ics.end.toUTC().startOf("minute").toISO() || "",
      appointmentName: ics.appointmentName || appointmentName || null,
      staffName: ics.staffName || staffName || null,
      confidence: 1,
      provider: "acuity",
      source: "acuity_ics",
      durationMinutes: ics.durationMinutes,
      durationSource: "range",
    }];
  }

  const textDateTime = findLabelValue(lines, ["Date/Time", "Date Time"]);
  const textDate = findLabelValue(lines, ["Date", "Appointment Date"]);
  const textTime = findLabelValue(lines, ["Time", "Appointment Time"]);
  const textParsed = parseStructuredDateTime(textDate, textTime, textDateTime, merchantTimeZone, defaultDuration);
  if (textParsed) {
    return [{
      startTimeUtc: textParsed.start.toUTC().startOf("minute").toISO() || "",
      endTimeUtc: textParsed.end.toUTC().startOf("minute").toISO() || "",
      appointmentName: appointmentName || null,
      staffName: staffName || null,
      confidence: 1,
      provider: "acuity",
      source: "acuity_text",
      durationMinutes: textParsed.durationMinutes,
      durationSource: textParsed.durationSource,
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
