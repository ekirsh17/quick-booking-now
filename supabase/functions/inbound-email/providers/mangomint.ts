import { DateTime } from "https://esm.sh/luxon@3.4.4";
import {
  collectTextLines,
  extractStaffHint,
  findLabelValue,
  parseStructuredDateTime,
  stripHtml,
  type ParsedCancellation,
} from "../utils.ts";

type MangomintInput = {
  fromAddress: string;
  subject: string;
  html: string;
  text: string;
  merchantTimeZone: string;
  defaultDuration: number;
  baseDate: DateTime | null;
};

export { type ParsedCancellation };

export function parseMangomintEmail(input: MangomintInput): ParsedCancellation[] | null {
  const { fromAddress, subject, html, text, merchantTimeZone, defaultDuration, baseDate } = input;
  const normalized = `${fromAddress} ${subject} ${text} ${stripHtml(html)}`.toLowerCase();
  const hasCancelSignal = normalized.includes("cancelled") || normalized.includes("canceled");
  const hasRescheduleSignal = normalized.includes("reschedul") || normalized.includes("moved");
  const isMangomint = /@[^>\s]*(mangomint|mg\.mangomint)\.com/i.test(fromAddress) || normalized.includes("mangomint");
  if ((!hasCancelSignal && !hasRescheduleSignal) || !isMangomint) return null;

  const lines = collectTextLines(html, text);
  const lineText = lines.join("\n");
  const service = findLabelValue(lines, ["Service", "Appointment Type", "Appointment"]);
  const staff = findLabelValue(lines, ["Staff", "Provider", "With"]) || extractStaffHint(lineText);
  const dateValue = findLabelValue(lines, ["Date", "Appointment Date"]);
  const timeValue = findLabelValue(lines, ["Time", "Appointment Time"]);
  const dateTimeValue = findLabelValue(lines, ["Date/Time", "Date Time"]);

  const foundStructuredFields = Boolean(service || staff || dateValue || timeValue || dateTimeValue);
  if (!foundStructuredFields) {
    return null;
  }

  const parsed = parseStructuredDateTime(dateValue, timeValue, dateTimeValue, merchantTimeZone, defaultDuration, baseDate);
  if (!parsed) return null;

  return [{
    startTimeUtc: parsed.start.toUTC().startOf("minute").toISO() || "",
    endTimeUtc: parsed.end.toUTC().startOf("minute").toISO() || "",
    appointmentName: service || null,
    staffName: staff || null,
    confidence: 1,
    provider: "mangomint",
    source: "mangomint_html",
    durationMinutes: parsed.durationMinutes,
    durationSource: parsed.durationSource,
  }];
}
