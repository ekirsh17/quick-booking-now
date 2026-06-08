import { describe, expect, it } from "vitest";
import {
  bulkDeleteLocationButtonLabel,
  bulkDeleteLocationModalBody,
  bulkDeleteLocationModalTitle,
  bulkDeleteStaffButtonLabel,
  bulkDeleteStaffModalBody,
  bulkDeleteStaffModalTitle,
  formatUpcomingOpenings,
  locationDeletionWarningBody,
  staffDeletionWarningBody,
} from "./deletionBlockCopy";

describe("deletionBlockCopy", () => {
  it("formats upcoming opening counts", () => {
    expect(formatUpcomingOpenings(1)).toBe("1 upcoming opening");
    expect(formatUpcomingOpenings(2)).toBe("2 upcoming openings");
  });

  it("builds location warning copy with plural pronouns", () => {
    expect(locationDeletionWarningBody("flatiron", 2)).toBe(
      "flatiron has 2 upcoming openings. Manage them in Openings, or delete them and remove this location below.",
    );
  });

  it("builds location warning copy with singular pronouns", () => {
    expect(locationDeletionWarningBody("flatiron", 1)).toBe(
      "flatiron has 1 upcoming opening. Manage it in Openings, or delete it and remove this location below.",
    );
  });

  it("builds staff warning copy with singular pronouns", () => {
    expect(staffDeletionWarningBody("joe", 1)).toBe(
      "joe has 1 upcoming opening. Manage it in Openings, or delete it and remove this staff member below.",
    );
  });

  it("builds staff warning copy with plural pronouns", () => {
    expect(staffDeletionWarningBody("joe", 2)).toContain("Manage them in Openings");
  });

  it("builds modal copy", () => {
    expect(bulkDeleteLocationModalBody("hkhj", 1)).toContain("1 upcoming opening");
    expect(bulkDeleteStaffModalBody("joe", 2)).toContain("2 upcoming openings");
  });

  it("uses singular opening in bulk action labels when count is 1", () => {
    expect(bulkDeleteLocationButtonLabel(1)).toBe("Delete opening and location");
    expect(bulkDeleteLocationButtonLabel(2)).toBe("Delete openings and location");
    expect(bulkDeleteStaffButtonLabel(1)).toBe("Delete opening and remove staff");
    expect(bulkDeleteStaffButtonLabel(2)).toBe("Delete openings and remove staff");
    expect(bulkDeleteLocationModalTitle(1)).toBe("Delete opening and remove location?");
    expect(bulkDeleteLocationModalTitle(2)).toBe("Delete openings and remove location?");
    expect(bulkDeleteStaffModalTitle(1)).toBe("Delete opening and remove staff?");
    expect(bulkDeleteStaffModalTitle(2)).toBe("Delete openings and remove staff?");
  });
});
