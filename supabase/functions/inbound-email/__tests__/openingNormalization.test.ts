import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  findSingleStaffMatch,
  isLowQualityAppointmentName,
  normalizeForNameMatch,
  resolveAppointmentName,
  resolveSoleStaffFallbackFromList,
  resolveStaffMatchFromList,
  type StaffRecord,
} from "../openingNormalization.ts";

const sarah: StaffRecord = { id: "staff-sarah", name: "Sarah Johnson", location_id: "loc-1" };
const marcus: StaffRecord = { id: "staff-marcus", name: "Marcus Thompson", location_id: "loc-1" };
const solo: StaffRecord = { id: "staff-solo", name: "Alex Rivera", location_id: "loc-1" };

Deno.test("resolveSoleStaffFallbackFromList returns id only for exactly one staff", () => {
  assertEquals(resolveSoleStaffFallbackFromList([solo]), solo);
  assertEquals(resolveSoleStaffFallbackFromList([]), null);
  assertEquals(resolveSoleStaffFallbackFromList([sarah, marcus]), null);
});

Deno.test("resolveStaffMatchFromList matches unambiguous full name hint", () => {
  const staff = [sarah, marcus];
  const match = resolveStaffMatchFromList(
    staff,
    "cancellation for sarah johnson on friday",
    "Sarah Johnson"
  );
  assertEquals(match?.id, "staff-sarah");
});

Deno.test("resolveStaffMatchFromList returns null for ambiguous first name", () => {
  const staff = [
    { id: "staff-sarah-1", name: "Sarah Johnson", location_id: "loc-1" },
    { id: "staff-sarah-2", name: "Sarah Lee", location_id: "loc-1" },
  ];
  const match = resolveStaffMatchFromList(staff, "cancelled with sarah", "Sarah");
  assertEquals(match, null);
});

Deno.test("findSingleStaffMatch matches first name when unique", () => {
  const normalized = normalizeForNameMatch("Provider: Marcus T. on Friday");
  const match = findSingleStaffMatch([marcus], normalized);
  assertEquals(match?.id, "staff-marcus");
});

Deno.test("resolveAppointmentName rejects low-quality calendar titles", () => {
  const junkCases = [
    "30-minute meeting",
    "30 Minute Meeting",
    "Appointment with Sarah",
    "cancelled: haircut",
    "meeting",
    "appointment",
    "30 minute meeting",
    "",
    null,
  ];

  for (const name of junkCases) {
    assertEquals(resolveAppointmentName({ appointmentName: name }), null);
  }
});

Deno.test("resolveAppointmentName keeps meaningful service titles", () => {
  const goodCases = [
    "Deep Tissue Massage",
    "Haircut",
    "30 Minute Massage",
    "Facial",
    "Color + Cut",
    "Balayage",
  ];

  for (const name of goodCases) {
    assertEquals(resolveAppointmentName({ appointmentName: name }), name);
    assertEquals(isLowQualityAppointmentName(name), false);
  }
});

Deno.test("isLowQualityAppointmentName flags duration plus generic calendar words", () => {
  assertEquals(isLowQualityAppointmentName("30-minute meeting"), true);
  assertEquals(isLowQualityAppointmentName("60 minute appointment"), true);
  assertEquals(isLowQualityAppointmentName("30 Minute Massage"), false);
});
