import { describe, expect, it } from "vitest";
import { formatAgendaPhone } from "./agendaPhoneFormat";

describe("formatAgendaPhone", () => {
  it("formats E.164 US numbers for agenda display", () => {
    expect(formatAgendaPhone("+13479793605")).toBe("(347) 979-3605");
  });

  it("formats 11-digit US numbers without a plus", () => {
    expect(formatAgendaPhone("13479793605")).toBe("(347) 979-3605");
  });

  it("formats 10-digit US numbers", () => {
    expect(formatAgendaPhone("3479793605")).toBe("(347) 979-3605");
  });

  it("formats already-punctuated US numbers", () => {
    expect(formatAgendaPhone("(347) 979-3605")).toBe("(347) 979-3605");
  });

  it("returns the original value when it cannot normalize to 10 digits", () => {
    expect(formatAgendaPhone("+442079460958")).toBe("+442079460958");
    expect(formatAgendaPhone("123")).toBe("123");
  });
});
