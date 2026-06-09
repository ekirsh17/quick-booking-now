import { DateTime } from "https://esm.sh/luxon@3.4.4";
import {
  collectTextLines,
  extractDateToken,
  extractStaffHint,
  extractTimeRange,
  extractTimeToken,
  findLabelValue,
  parseCancellationFromIcs,
  parseDateAndTime,
  parseDateTimeValue,
  stripHtml,
  type Attachment,
  type ParsedCancellation,
} from "../utils.ts";

type SquareInput = {
  fromAddress: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Attachment[] | null;
  merchantTimeZone: string;
  defaultDuration: number;
};

export { type ParsedCancellation };

export function parseSquareEmail(input: SquareInput): ParsedCancellation[] | null {
  const { fromAddress, subject, html, text, attachments, merchantTimeZone, defaultDuration } = input;
  const normalized = `${fromAddress} ${subject} ${text} ${stripHtml(html)}`.toLowerCase();
  const isReschedule = normalized.includes("reschedul") || normalized.includes("moved appointment");
  const isCancel = normalized.includes("appointment") &&
    (normalized.includes("cancelled") || normalized.includes("canceled")) &&
    !normalized.includes("you have cancelled");

  if (!isCancel && !isReschedule) return null;

  const lines = collectTextLines(html, text);
  const lineText = lines.join("\n");
  const service = findLabelValue(lines, ["Service", "Appointment Type", "Service Name"]);
  const staff = findLabelValue(lines, ["Provider", "Staff Member", "Staff", "With"]) || extractStaffHint(lineText);
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
      provider: "square",
      source: "square_html",
      durationMinutes: htmlParsed.durationMinutes,
      durationSource: htmlParsed.durationSource,
    }];
  }

  const subjectDate = extractDateToken(subject);
  const subjectTime = extractTimeToken(subject);
  const subjectStart = parseDateAndTime(subjectDate, subjectTime, merchantTimeZone);
  if (subjectStart) {
    const subjectRange = extractTimeRange(subject);
    const subjectEnd = subjectRange?.end
      ? parseDateAndTime(subjectDate, subjectRange.end, merchantTimeZone)
      : subjectStart.plus({ minutes: defaultDuration });
    const end = subjectEnd && subjectEnd > subjectStart ? subjectEnd : subjectStart.plus({ minutes: defaultDuration });
    return [{
      startTimeUtc: subjectStart.toUTC().startOf("minute").toISO() || "",
      endTimeUtc: end.toUTC().startOf("minute").toISO() || "",
      appointmentName: service || null,
      staffName: staff || null,
      confidence: 1,
      provider: "square",
      source: "square_subject",
      durationMinutes: Math.max(5, Math.round(end.diff(subjectStart, "minutes").minutes)),
      durationSource: subjectRange ? "range" : "default",
    }];
  }

  const ics = parseCancellationFromIcs(attachments, merchantTimeZone);
  if (ics) {
    return [{
      startTimeUtc: ics.start.toUTC().startOf("minute").toISO() || "",
      endTimeUtc: ics.end.toUTC().startOf("minute").toISO() || "",
      appointmentName: ics.appointmentName || service || null,
      staffName: ics.staffName || staff || null,
      confidence: 1,
      provider: "square",
      source: "square_ics",
      durationMinutes: ics.durationMinutes,
      durationSource: "range",
    }];
  }

  const plainText = `${text}\n${stripHtml(html)}`;
  const plainDate = extractDateToken(plainText);
  const plainTime = extractTimeToken(plainText);
  const plainStart = parseDateAndTime(plainDate, plainTime, merchantTimeZone);
  if (plainStart) {
    const plainRange = extractTimeRange(plainText);
    const plainEnd = plainRange?.end
      ? parseDateAndTime(plainDate, plainRange.end, merchantTimeZone)
      : plainStart.plus({ minutes: defaultDuration });
    const end = plainEnd && plainEnd > plainStart ? plainEnd : plainStart.plus({ minutes: defaultDuration });
    return [{
      startTimeUtc: plainStart.toUTC().startOf("minute").toISO() || "",
      endTimeUtc: end.toUTC().startOf("minute").toISO() || "",
      appointmentName: service || null,
      staffName: staff || extractStaffHint(plainText),
      confidence: 1,
      provider: "square",
      source: "square_text",
      durationMinutes: Math.max(5, Math.round(end.diff(plainStart, "minutes").minutes)),
      durationSource: plainRange ? "range" : "default",
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
