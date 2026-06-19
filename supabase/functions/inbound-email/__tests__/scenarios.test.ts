import { assertEquals, assertExists } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { DateTime } from "https://esm.sh/luxon@3.4.4";
import { parseSetmoreEmail } from "../providers/setmore.ts";
import { parseBooksyEmail } from "../providers/booksy.ts";
import { parseSquareEmail } from "../providers/square.ts";
import { parseVagaroEmail } from "../providers/vagaro.ts";
import { parseAcuityEmail } from "../providers/acuity.ts";
import { parseFreshaEmail } from "../providers/fresha.ts";
import { parseGlossGeniusEmail } from "../providers/glossgenius.ts";
import { parseDateAndTime, parseStructuredDateTime, collectTextLines, findLabelValue } from "../utils.ts";

const TZ = "America/New_York";
const BASE_DATE = DateTime.fromRFC2822("Mon, 09 Jun 2025 12:00:00 +0000");

function slotMatches(iso: string, expectedUtc: string, toleranceMin = 30): boolean {
  const actual = new Date(iso).getTime();
  const expected = new Date(expectedUtc).getTime();
  return Math.abs(actual - expected) <= toleranceMin * 60 * 1000;
}

Deno.test("Setmore regression parses June 27 10:00 AM EDT", () => {
  const result = parseSetmoreEmail({
    subject: "Appointment canceled: Fri 27 Jun 2025 at 10:00 AM (EDT)",
    html: "<p>Your appointment has been canceled.</p><p><b>What</b></p><p>Haircut</p><p><b>When</b></p><p>Fri 27 Jun 2025 10:00 AM - 10:30 AM EDT</p>",
    text: "Your appointment has been canceled.\nService: Haircut\nDate: Friday, June 27, 2025\nTime: 10:00 AM - 10:30 AM EDT",
    attachments: null,
    merchantTimeZone: TZ,
    defaultDuration: 30,
    baseDate: BASE_DATE,
  });
  assertExists(result);
  assertEquals(result!.length, 1);
  assertEquals(result![0].provider, "setmore");
  assertEquals(slotMatches(result![0].startTimeUtc, "2025-06-27T14:00:00.000Z"), true);
});

Deno.test("Booksy regression parses June 27 2:00 PM EDT", () => {
  const result = parseBooksyEmail({
    subject: "cancelled appointment on: Friday, June 27, 2025 2:00 PM",
    html: "<p>Your client <b>cancelled appointment</b> for <b>Manicure</b> on: <b>Friday, June 27, 2025, 2:00 PM - 2:30 PM</b></p>",
    text: "Your client cancelled appointment for Manicure on: Friday, June 27, 2025, 2:00 PM - 2:30 PM",
    merchantTimeZone: TZ,
    defaultDuration: 30,
  });
  assertExists(result);
  assertEquals(result!.length, 1);
  assertEquals(result![0].provider, "booksy");
  assertEquals(slotMatches(result![0].startTimeUtc, "2025-06-27T18:00:00.000Z"), true);
});

Deno.test("Square parses structured labels with 60-minute range", () => {
  const text = "An appointment has been cancelled.\nService: Deep Tissue Massage\nProvider: Marcus T.\nDate: Friday, June 27, 2025\nTime: 11:00 AM - 12:00 PM";
  const html = "<table><tr><td><strong>Service</strong></td><td>Deep Tissue Massage</td></tr><tr><td><strong>Provider</strong></td><td>Marcus T.</td></tr><tr><td><strong>Date</strong></td><td>Friday, June 27, 2025</td></tr><tr><td><strong>Time</strong></td><td>11:00 AM - 12:00 PM</td></tr></table>";
  const result = parseSquareEmail({
    fromAddress: "noreply@squareup.com",
    subject: "Appointment Cancelled",
    html,
    text,
    merchantTimeZone: TZ,
    defaultDuration: 30,
    baseDate: BASE_DATE,
  });
  assertExists(result);
  assertEquals(result!.length, 1);
  assertEquals(result![0].provider, "square");
  assertEquals(result![0].source?.startsWith("square_"), true);
  assertEquals(result![0].staffName, "Marcus T.");
  assertEquals(result![0].durationMinutes, 60);
  assertEquals(slotMatches(result![0].startTimeUtc, "2025-06-27T15:00:00.000Z"), true);
});

Deno.test("Vagaro parses 120-minute range on June 28", () => {
  const text = "An appointment has been cancelled.\nService: Balayage\nProvider: Jessica R.\nDate: Saturday, June 28, 2025\nTime: 1:00 PM - 3:00 PM";
  const result = parseVagaroEmail({
    fromAddress: "noreply@vagaro.com",
    subject: "Appointment Cancelled - Vagaro",
    html: "",
    text,
    merchantTimeZone: TZ,
    defaultDuration: 30,
    baseDate: BASE_DATE,
  });
  assertExists(result);
  assertEquals(result![0].durationMinutes, 120);
  assertEquals(slotMatches(result![0].startTimeUtc, "2025-06-28T17:00:00.000Z"), true);
});

Deno.test("Acuity parses 2025 date with staff from Calendar label", () => {
  const text = "An appointment has been cancelled.\nAppointment Type: Facial\nDate/Time: June 27, 2025 at 3:00 PM EDT\nCalendar: Sarah";
  const result = parseAcuityEmail({
    fromAddress: "no-reply@acuityscheduling.com",
    subject: "Cancelled: Facial with Sarah on June 27, 2025",
    html: "",
    text,
    merchantTimeZone: TZ,
    defaultDuration: 30,
    baseDate: BASE_DATE,
  });
  assertExists(result);
  assertEquals(result![0].provider, "acuity");
  assertEquals(result![0].appointmentName, "Facial");
  assertEquals(result![0].staffName, "Sarah");
  assertEquals(slotMatches(result![0].startTimeUtc, "2025-06-27T19:00:00.000Z"), true);
  assertEquals(result![0].startTimeUtc.startsWith("2025-"), true);
});

Deno.test("Fresha parses June 27 4:00 PM with 60-minute duration", () => {
  const text = "An appointment has been cancelled.\nService: Swedish Massage\nWith: Daniel K.\nDate: Friday, June 27, 2025\nTime: 4:00 PM - 5:00 PM";
  const result = parseFreshaEmail({
    fromAddress: "no-reply@fresha.com",
    subject: "Appointment cancelled at The Studio",
    html: "",
    text,
    merchantTimeZone: TZ,
    defaultDuration: 30,
    baseDate: BASE_DATE,
  });
  assertExists(result);
  assertEquals(result![0].provider, "fresha");
  assertEquals(result![0].durationMinutes, 60);
  assertEquals(slotMatches(result![0].startTimeUtc, "2025-06-27T20:00:00.000Z"), true);
});

Deno.test("GlossGenius parses June 28 10:00 AM", () => {
  const text = "An appointment has been cancelled.\nService: Color + Cut\nProvider: Aisha M.\nDate: Saturday, June 28, 2025\nTime: 10:00 AM";
  const result = parseGlossGeniusEmail({
    fromAddress: "no-reply@glossgenius.com",
    subject: "Appointment Cancelled: Color + Cut on June 28",
    html: "",
    text,
    merchantTimeZone: TZ,
    defaultDuration: 30,
    baseDate: BASE_DATE,
  });
  assertExists(result);
  assertEquals(slotMatches(result![0].startTimeUtc, "2025-06-28T14:00:00.000Z"), true);
});

Deno.test("Generic explicit date beats weekday-relative resolution", () => {
  const text = "Your appointment for a Haircut with Stylist: James on Friday, June 27, 2025 at 9:00 AM has been cancelled.";
  const parsed = parseDateAndTime("Friday, June 27, 2025", "9:00 AM", TZ, BASE_DATE);
  assertExists(parsed);
  assertEquals(slotMatches(parsed!.toUTC().toISO()!, "2025-06-27T13:00:00.000Z"), true);
  assertEquals(parsed!.year, 2025);

  const lines = collectTextLines("", text);
  const structured = parseStructuredDateTime(
    findLabelValue(lines, ["Date"]),
    findLabelValue(lines, ["Time"]),
    null,
    TZ,
    30,
    BASE_DATE,
  );
  if (structured) {
    assertEquals(slotMatches(structured.start.toUTC().toISO()!, "2025-06-27T13:00:00.000Z"), true);
  }
});

Deno.test("Provider parsers return null (not empty array) on no match", () => {
  const empty = parseSquareEmail({
    fromAddress: "noreply@squareup.com",
    subject: "Hello",
    html: "",
    text: "No cancellation here",
    merchantTimeZone: TZ,
    defaultDuration: 30,
    baseDate: BASE_DATE,
  });
  assertEquals(empty, null);
});

import {
  isForwardingVerification,
  parseForwardingVerificationEmail,
} from "../../shared/inboundEmailVerification.ts";

Deno.test("Outlook forwarding verification is detected with extracted URL", () => {
  const subject = "Verify your forwarding address";
  const text = "Please confirm your request to forward mail. Click https://account.live.com/Aliases/Verify?token=test";
  assertEquals(isForwardingVerification(subject, text), true);

  const parsed = parseForwardingVerificationEmail(subject, text);
  assertEquals(parsed.isVerification, true);
  assertEquals(parsed.verificationUrl?.includes("account.live.com"), true);
});

Deno.test("Cancellation emails are not treated as forwarding verification", () => {
  assertEquals(
    isForwardingVerification(
      "Appointment canceled: Fri 27 Jun 2025 at 10:00 AM",
      "Your appointment has been canceled.",
    ),
    false,
  );
});
