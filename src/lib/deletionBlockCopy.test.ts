import { describe, expect, it } from "vitest";
import {
  bulkDeleteLocationModalBody,
  bulkDeleteStaffModalBody,
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
});
