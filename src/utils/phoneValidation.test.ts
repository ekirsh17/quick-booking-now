import { describe, expect, it } from "vitest";
import { isValidPhoneNumber } from "react-phone-number-input";
import { toPhoneInputValue } from "./phoneValidation";

describe("toPhoneInputValue", () => {
  it("returns empty string for null, undefined, or blank input", () => {
    expect(toPhoneInputValue(null)).toBe("");
    expect(toPhoneInputValue(undefined)).toBe("");
    expect(toPhoneInputValue("")).toBe("");
    expect(toPhoneInputValue("   ")).toBe("");
  });

  it("normalizes US numbers stored without a leading plus", () => {
    expect(toPhoneInputValue("13479793605")).toBe("+13479793605");
    expect(toPhoneInputValue("3479793605")).toBe("+13479793605");
  });

  it("passes through valid E.164 values unchanged", () => {
    expect(toPhoneInputValue("+13479793605")).toBe("+13479793605");
  });

  it("normalizes formatted US numbers", () => {
    expect(toPhoneInputValue("(347) 979-3605")).toBe("+13479793605");
  });

  it("returns empty string for invalid or too-short values", () => {
    expect(toPhoneInputValue("123")).toBe("");
    expect(toPhoneInputValue("not-a-phone")).toBe("");
  });

  it("produces a value PhoneInput can validate for raw signup storage", () => {
    const rawSignupPhone = "13479793605";
    expect(isValidPhoneNumber(rawSignupPhone)).toBe(false);

    const prefill = toPhoneInputValue(rawSignupPhone);
    expect(prefill).toBe("+13479793605");
    expect(isValidPhoneNumber(prefill)).toBe(true);
  });
});
