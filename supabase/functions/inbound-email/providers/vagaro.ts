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

type VagaroInput = {
  fromAddress: string;
  subject: string;
  html: string;
  text: string;
  merchantTimeZone: string;
  defaultDuration: number;
};

export { type ParsedCancellation };

export function parseVagaroEmail(input: VagaroInput): ParsedCancellation[] | null {
  const { fromAddress, subject, html, text, merchantTimeZone, defaultDuration } = input;
  const normalized = `${fromAddress} ${subject} ${text} ${stripHtml(html)}`.toLowerCase();
  const hasCancelSignal = normalized.includes("cancelled") || normalized.includes("canceled");
  const hasRescheduleSignal = normalized.includes("reschedul") || normalized.includes("moved");
  const isVagaro = normalized.includes("vagaro") || /@[^>\s]*vagaro\.com/i.test(fromAddress);

  if ((!hasCancelSignal && !hasRescheduleSignal) || !isVagaro) return null;

  const lines = collectTextLines(html, text);
  const lineText = lines.join("\n");
  const service = findLabelValue(lines, ["Service", "Appointment Type"]);
  const staff = findLabelValue(lines, ["Provider", "Staff", "With"]) || extractStaffHint(lineText);
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
      provider: "vagaro",
      source: "vagaro_html",
      durationMinutes: htmlParsed.durationMinutes,
      durationSource: htmlParsed.durationSource,
    }];
  }

  const plainText = `${text}\n${stripHtml(html)}`;
  const plainPattern = plainText.match(
    /([A-Za-z][A-Za-z0-9 '&-]{2,})\s+with\s+([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,2})\s+on\s+([^,\n]+(?:,\s*\d{4})?)\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:AM|PM|A\.?M\.?|P\.?M\.?))/i
  );
  if (plainPattern) {
    const start = parseDateAndTime(plainPattern[3], plainPattern[4], merchantTimeZone);
    if (start) {
      const end = start.plus({ minutes: defaultDuration });
      return [{
        startTimeUtc: start.toUTC().startOf("minute").toISO() || "",
        endTimeUtc: end.toUTC().startOf("minute").toISO() || "",
        appointmentName: plainPattern[1].trim(),
        staffName: plainPattern[2].trim(),
        confidence: 1,
        provider: "vagaro",
        source: "vagaro_text",
        durationMinutes: defaultDuration,
        durationSource: "default",
      }];
    }
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
      provider: "vagaro",
      source: "vagaro_subject",
      durationMinutes: Math.max(5, Math.round(end.diff(subjectStart, "minutes").minutes)),
      durationSource: subjectRange ? "range" : "default",
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
