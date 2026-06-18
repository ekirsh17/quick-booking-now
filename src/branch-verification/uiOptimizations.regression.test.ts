import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSrc = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("feature/ui-optimizations regression guards", () => {
  describe("billing: remove trial seat-change notice (90badf0)", () => {
    const billingSource = readSrc("src/pages/merchant/Billing.tsx");

    it("does not render the removed trial seat-change helper copy", () => {
      expect(billingSource).not.toContain("Seat change charges apply after trial ends");
      expect(billingSource).not.toContain("Free trial active. Seat change charges");
    });

    it("does not depend on isTrialing for seat management layout", () => {
      expect(billingSource).not.toMatch(/\bisTrialing\b/);
    });

    it("still renders seat management when subscription and plan exist", () => {
      expect(billingSource).toContain("<SeatManagement");
    });
  });

  describe("onboarding: staff name prefill removal (3d5c166)", () => {
    const onboardingHookSource = readSrc("src/hooks/useOnboarding.tsx");
    const migrationSource = readSrc(
      "supabase/migrations/20260618203036_bootstrap_primary_staff_placeholder.sql",
    );

    it("does not hydrate staff names from bootstrap staff records", () => {
      expect(onboardingHookSource).not.toContain("primaryStaff?.name");
      expect(onboardingHookSource).not.toContain("setStaffFirstName(first");
    });

    it("uses a fixed placeholder staff name in the bootstrap migration", () => {
      expect(migrationSource).toContain("'Primary Staff'");
      expect(migrationSource).toContain(
        "Business name defaults (e.g. \"My Business\") must not flow into staff.name",
      );
    });
  });

  describe("onboarding: booking system dropdown styling (6a32ebb)", () => {
    const businessProfileSource = readSrc("src/components/onboarding/BusinessProfileStep.tsx");

    it("applies the same first-open highlight class to booking system options", () => {
      expect(businessProfileSource).toContain("const firstOpenSelectedDropdownItemClass");
      expect(businessProfileSource).toMatch(
        /!bookingSystemProvider\s*\?\s*firstOpenSelectedDropdownItemClass/,
      );
    });
  });

  describe("admin: hide dev navigation in production (c1af68f)", () => {
    const featureFlagsSource = readSrc("src/lib/featureFlags.ts");
    const appSource = readSrc("src/App.tsx");
    const adminContextSource = readSrc("src/contexts/AdminContext.tsx");

    it("gates admin UI behind IS_ADMIN_ENABLED", () => {
      expect(featureFlagsSource).toContain("import.meta.env.DEV");
      expect(featureFlagsSource).toContain("VITE_ENABLE_ADMIN");
      expect(appSource).toContain("{IS_ADMIN_ENABLED ? (");
      expect(appSource).toContain("<AdminProvider>");
      expect(adminContextSource).toContain("useState(IS_ADMIN_ENABLED)");
    });

    it("strips admin navigation strings from production bundles", () => {
      const bundleDir = resolve(process.cwd(), "dist/assets");
      const bundleFile = readdirSync(bundleDir).find(
        (file) => file.endsWith(".js") && file.startsWith("index-"),
      );
      expect(bundleFile).toBeTruthy();

      const bundleSource = readFileSync(resolve(bundleDir, bundleFile!), "utf8");
      expect(bundleSource).not.toContain("Open admin panel");
      expect(bundleSource).not.toContain("Admin Panel");
    });
  });

  describe("consumer: claim opening layout (139407b)", () => {
    const claimBookingSource = readSrc("src/pages/ClaimBooking.tsx");

    it("renders address before the availability badge", () => {
      const addressIndex = claimBookingSource.indexOf("slot.profiles?.address");
      const badgeIndex = claimBookingSource.indexOf("One spot just opened");
      expect(addressIndex).toBeGreaterThan(-1);
      expect(badgeIndex).toBeGreaterThan(addressIndex);
    });

    it("hides empty appointment names and pairs duration with staff inline", () => {
      expect(claimBookingSource).toContain("slot.appointment_name?.trim()");
      expect(claimBookingSource).toContain("{appointmentDurationMinutes} min");
      expect(claimBookingSource).toContain("slot.staff_name?.trim()");
    });
  });

  describe("consumer: booking confirmed confetti wiring (fbd87af)", () => {
    const bookingConfirmedSource = readSrc("src/pages/BookingConfirmed.tsx");

    it("mounts BookingSuccessConfetti behind scenario gating", () => {
      expect(bookingConfirmedSource).toContain("BookingSuccessConfetti");
      expect(bookingConfirmedSource).toContain("showSuccessConfetti");
      expect(bookingConfirmedSource).toContain("shouldShowBookingSuccessConfetti");
      expect(bookingConfirmedSource).toContain("resolveBookingConfirmedScenario");
    });
  });
});
