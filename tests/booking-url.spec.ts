import { test, expect } from "@playwright/test";
import { normalizeBookingUrl, validateAndNormalizeBookingUrl } from "../src/utils/bookingUrl";

test.describe("booking URL normalization", () => {
  test("normalizes bare domains and www inputs to https", () => {
    expect(normalizeBookingUrl("booksy.com/my-biz")).toBe("https://booksy.com/my-biz");
    expect(normalizeBookingUrl("www.booksy.com")).toBe("https://www.booksy.com/");
  });

  test("preserves explicit http/https URLs and path/query/hash", () => {
    expect(normalizeBookingUrl("http://booksy.com/a")).toBe("http://booksy.com/a");
    expect(normalizeBookingUrl("https://booksy.com?a=1#x")).toBe("https://booksy.com/?a=1#x");
  });

  test("rejects invalid and unsupported protocols", () => {
    const invalidResult = validateAndNormalizeBookingUrl("http://");
    expect(invalidResult.ok).toBe(false);

    const textResult = validateAndNormalizeBookingUrl("not a url");
    expect(textResult.ok).toBe(false);

    const ftpResult = validateAndNormalizeBookingUrl("ftp://booksy.com");
    expect(ftpResult.ok).toBe(false);

    const jsResult = validateAndNormalizeBookingUrl("javascript:alert(1)");
    expect(jsResult.ok).toBe(false);
  });
});
