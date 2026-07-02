import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSrc = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

/** Mirrors SavingsCalculator math in Landing.tsx */
const round10 = (x: number) => Math.round(x / 10) * 10;
const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

const calcSavings = (ticket: number, cancels: number) => {
  const weeks = 4.3;
  const atRisk = ticket * cancels * weeks;
  const recovered = atRisk * 0.94;
  const year = round10(recovered) * 12;
  return {
    atRisk: money(round10(atRisk)),
    recovered: money(round10(recovered)),
    year: money(year),
  };
};

describe("homepage: Landing.tsx integration guards", () => {
  const landingSource = readSrc("src/pages/Landing.tsx");
  const appSource = readSrc("src/App.tsx");

  it("imports the compressed WebP QR asset (not legacy PNG)", () => {
    expect(landingSource).toContain('@/assets/qr-card-counter.webp');
    expect(landingSource).not.toContain("qr-card-counter.png");
    expect(existsSync(resolve(process.cwd(), "src/assets/qr-card-counter.webp"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "src/assets/qr-card-counter.png"))).toBe(false);
  });

  it("keeps QR asset under 200 KB after compression", () => {
    const webpPath = resolve(process.cwd(), "src/assets/qr-card-counter.webp");
    const sizeKb = statSync(webpPath).size / 1024;
    expect(sizeKb).toBeLessThan(200);
  });

  it("only wires / to Landing in App routes", () => {
    expect(appSource).toContain('<Route path="/" element={<Landing />} />');
    const landingRouteMatches = appSource.match(/element=\{<Landing/g) ?? [];
    expect(landingRouteMatches).toHaveLength(1);
  });

  it("routes all homepage CTAs to merchant login", () => {
    const ctaLinks = landingSource.match(/to="\/merchant\/login"/g) ?? [];
    expect(ctaLinks.length).toBeGreaterThanOrEqual(4);
    expect(landingSource).not.toMatch(/to="\/consumer\/sign-in"/);
  });

  it("uses Button asChild with Link for primary CTAs", () => {
    expect(landingSource).toContain("<Button asChild>");
    expect(landingSource).toContain("<Link to=\"/merchant/login\">Start free</Link>");
  });

  it("defines anchor sections for in-page navigation", () => {
    expect(landingSource).toContain('id="how"');
    expect(landingSource).toContain('id="math"');
    expect(landingSource).toContain('id="start"');
    expect(landingSource).toContain('window.location.hash = "#how"');
  });

  it("scopes custom CSS with oa- prefix to avoid global leaks", () => {
    expect(landingSource).toContain(".oa-slider");
    expect(landingSource).toContain("@keyframes oaPing");
    expect(landingSource).toContain("@media (prefers-reduced-motion: reduce)");
    expect(landingSource).not.toMatch(/@keyframes\s+(?!oa)[a-z]/);
  });

  it("renders major marketing sections", () => {
    const sections = [
      "Notify me if an appointment opens up in the next three days",
      "Turn Cancellations Into Revenue",
      "OpenAlert fills your empty slots",
      "Automatically text clients when there's an opening",
      "Still filling cancellations by hand?",
      "Save your time and increase their satisfaction",
      "Customers join in seconds",
      "Run your numbers",
      "Trusted by salons, spas, clinics, and more",
      "Start your free trial",
    ];
    for (const copy of sections) {
      expect(landingSource).toContain(copy);
    }
  });

  it("does not import or mutate shared app providers from Landing", () => {
    expect(landingSource).not.toContain("useAuth");
    expect(landingSource).not.toContain("QueryClient");
    expect(landingSource).not.toContain("supabase");
  });
});

describe("homepage: savings calculator math", () => {
  it("matches default slider values ($50 ticket, 4 cancels/week)", () => {
    expect(calcSavings(50, 4)).toEqual({
      atRisk: "$860",
      recovered: "$810",
      year: "$9,720",
    });
  });

  it("updates recovered amount when inputs change", () => {
    const low = calcSavings(20, 1);
    const high = calcSavings(250, 25);
    expect(low.recovered).toBe("$80");
    expect(high.recovered).toBe("$25,260");
  });

  it("uses 94% fill rate in recovered calculation", () => {
    const { recovered } = calcSavings(100, 10);
    // 100 * 10 * 4.3 * 0.94 = 4042 -> round10 -> 4040
    expect(recovered).toBe("$4,040");
  });
});

describe("homepage: no unintended route regressions", () => {
  const appSource = readSrc("src/App.tsx");

  const unchangedRoutes = [
    '<Route path="/merchant/login" element={<MerchantLogin />} />',
    '<Route path="/consumer/sign-in" element={<ConsumerSignIn />} />',
    '<Route path="/tools" element={<Tools />} />',
    '<Route path="*" element={<NotFound />} />',
  ];

  for (const route of unchangedRoutes) {
    it(`still declares ${route.match(/path="([^"]+)"/)?.[1]}`, () => {
      expect(appSource).toContain(route);
    });
  }
});
