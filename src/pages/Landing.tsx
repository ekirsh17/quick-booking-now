import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/LogoMark";
import qrCardCounter from "@/assets/qr-card-counter.webp";

/**
 * OpenAlert marketing homepage (/).
 * Self-contained leaf route component — reuses shadcn Button, react-router Link,
 * and LogoMark. Styling uses Tailwind on the existing CSS-variable tokens
 * (primary / muted-foreground / secondary / border / foreground). The only
 * non-utility CSS is the scoped keyframes + range-slider styling below, all
 * namespaced `oa-` so nothing leaks into other components.
 */

const round10 = (x: number) => Math.round(x / 10) * 10;
const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

const ArrowRight = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
);
const Check = ({ className = "h-5 w-5", color = "#2f8f3a" }: { className?: string; color?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
);
const Star = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#FF914D" stroke="none"><path d="M12 2l2.6 6.3L21 9l-5 4.4L17.5 20 12 16.6 6.5 20 8 13.4 3 9l6.4-.7z" /></svg>
);
const DollarSign = ({ className = "h-5 w-5", color = "#2f8f3a" }: { className?: string; color?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
);

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const QUOTES = [
  { q: "A no-show used to mean a dead hour. Now the opening's usually gone before I've finished sweeping up.", n: "Kenji", r: "Barber · Brooklyn, NY", i: "K", bg: "#DCEAFF", fg: "text-primary" },
  { q: "I used to blast cancellations on Instagram. Now the waitlist handles it.", n: "Marisol", r: "Salon owner · Austin, TX", i: "M", bg: "hsl(25 95% 64% / 0.18)", fg: "text-[#F97316]" },
  { q: "My front desk used to panic every time someone canceled. Not anymore.", n: "Dana", r: "Med-spa · Portland, OR", i: "D", bg: "#DCEAFF", fg: "text-primary" },
];

function QuoteFigure({ t }: { t: (typeof QUOTES)[number] }) {
  return (
    <figure className="m-0 flex flex-col">
      <div className="mb-4 flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} />)}</div>
      <blockquote className="m-0 flex-1 text-[19px] font-medium leading-[1.5] tracking-[-0.01em] text-foreground sm:text-[20px]">"{t.q}"</blockquote>
      <figcaption className="mt-6 flex items-center gap-2.5 border-t border-border pt-5">
        <div className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold ${t.fg}`} style={{ background: t.bg }}>{t.i}</div>
        <div><div className="text-[13px] font-semibold text-foreground">{t.n}</div><div className="text-[12px] text-muted-foreground">{t.r}</div></div>
      </figcaption>
    </figure>
  );
}

function QuoteCarousel() {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const slides = el.querySelectorAll<HTMLElement>("[data-quote]");
      const pad = Number.parseFloat(getComputedStyle(el).paddingLeft) || 0;
      const left = el.scrollLeft + pad;
      let best = 0;
      let bestDist = Infinity;
      slides.forEach((slide, i) => {
        const dist = Math.abs(slide.offsetLeft - left);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      setActive(best);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const goTo = (index: number) => {
    const el = scrollerRef.current;
    const slide = el?.querySelectorAll<HTMLElement>("[data-quote]")[index];
    if (!el || !slide) return;
    const pad = Number.parseFloat(getComputedStyle(el).paddingLeft) || 0;
    el.scrollTo({
      left: slide.offsetLeft - pad,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  return (
    <>
      <div className="overflow-x-clip md:hidden">
        <div
          ref={scrollerRef}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain pb-1 touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Customer quotes"
        >
          {QUOTES.map((t) => (
            <div key={t.n} data-quote className="w-full shrink-0 grow-0 basis-full snap-start">
              <QuoteFigure t={t} />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-center">
          {QUOTES.map((t, i) => (
            <button
              key={t.n}
              type="button"
              aria-label={`Show ${t.n}'s quote`}
              aria-current={i === active ? "true" : undefined}
              onClick={() => goTo(i)}
              className="flex h-8 w-8 items-center justify-center"
            >
              <span className={`block h-2 rounded-full ${i === active ? "w-6 bg-foreground" : "w-2 bg-[#D6D6D6]"}`} />
            </button>
          ))}
        </div>
      </div>
      <div className="hidden md:grid md:grid-cols-3 md:gap-10">
        {QUOTES.map((t) => <QuoteFigure key={t.n} t={t} />)}
      </div>
    </>
  );
}

/** Consistent uppercase eyebrow label used above each section headline. */
function SectionLabel({ children, tone = "primary" }: { children: ReactNode; tone?: "primary" | "blue" }) {
  const color = tone === "blue" ? "text-[#6EA4FF]" : "text-primary";
  return <div className={`mb-3 text-[12px] font-bold uppercase tracking-[0.14em] ${color}`}>{children}</div>;
}

/**
 * Counts a number up from 0 the first time it scrolls into view, then tracks
 * `value` live (so slider changes stay instant). Honors reduced-motion.
 */
function useCountUpOnView(value: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const revealed = useRef(false);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (revealed.current) setDisplay(value);
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      revealed.current = true;
      setDisplay(value);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || revealed.current) return;
        revealed.current = true;
        const target = value;
        const start = performance.now();
        const dur = 900;
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplay(target * eased);
          if (t < 1) requestAnimationFrame(tick);
          else setDisplay(target);
        };
        requestAnimationFrame(tick);
        io.disconnect();
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, display };
}

function SavingsCalculator() {
  const [ticket, setTicket] = useState(55);
  const [cancels, setCancels] = useState(2);
  const weeks = 4.3;
  const atRisk = ticket * cancels * weeks;
  const recovered = atRisk * 0.94;
  const year = round10(recovered) * 12;
  const { ref: recoveredRef, display: recoveredDisplay } = useCountUpOnView(round10(recovered));

  return (
    <div className="grid overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.04] md:grid-cols-2">
      {/* inputs */}
      <div className="border-b border-white/10 p-8 sm:p-10 md:border-b-0 md:border-r">
        <div className="mb-9">
          <div className="mb-4 flex items-baseline justify-between">
            <span className="min-w-0 text-[15px] font-medium text-white/70">Average ticket</span>
            <span className="shrink-0 whitespace-nowrap text-[22px] font-bold tracking-tight text-white sm:text-[26px]">${ticket}</span>
          </div>
          <input className="oa-slider" type="range" min={20} max={250} step={5} value={ticket} onChange={(e) => setTicket(Number(e.target.value))} />
          <div className="mt-2 flex justify-between text-[11.5px] text-white/40"><span>$20</span><span>$250</span></div>
        </div>
        <div>
          <div className="mb-4 flex items-baseline justify-between">
            <span className="min-w-0 text-[15px] font-medium text-white/70">Cancellations per week</span>
            <span className="shrink-0 whitespace-nowrap text-[22px] font-bold tracking-tight text-white sm:text-[26px]">{cancels} / week</span>
          </div>
          <input className="oa-slider" type="range" min={1} max={25} step={1} value={cancels} onChange={(e) => setCancels(Number(e.target.value))} />
          <div className="mt-2 flex justify-between text-[11.5px] text-white/40"><span>1</span><span>25</span></div>
        </div>
        <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-6">
          <span className="text-sm text-white/55">Revenue at risk each month</span>
          <span className="text-xl font-semibold text-[#FF914D]">{money(round10(atRisk))}</span>
        </div>
      </div>
      {/* output */}
      <div className="flex flex-col items-center justify-center bg-primary/[0.06] p-8 text-center sm:p-10">
        <div className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.06em] text-[#6EA4FF]">You could recover</div>
        <div ref={recoveredRef} className="text-[50px] font-extrabold leading-[0.95] tracking-[-0.04em] text-white sm:text-[60px] lg:text-[80px]">{money(recoveredDisplay)}</div>
        <div className="mt-2.5 text-[15px] text-white/55">per month, at a 94% fill rate</div>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--success)/0.16)] px-4 py-2">
          <DollarSign className="h-4 w-4" color="#7ED991" />
          <span className="text-[13.5px] font-semibold text-[#9be8a9]">That's {money(year)} a year</span>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const scrollToHow = () => {
    const section = document.getElementById("how");
    if (!section) return;
    const header = document.querySelector("header");
    const offset = (header?.getBoundingClientRect().height ?? 0) + 16;
    const top = section.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    if (window.location.hash !== "#how") window.history.pushState(null, "", "#how");
  };

  return (
    <div className="w-full overflow-x-clip bg-white text-foreground">
      <style>{`
        .oa-slider{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:99px;background:hsl(0 0% 100% / 0.16);outline:none;cursor:pointer;}
        .oa-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:26px;height:26px;border-radius:99px;background:#fff;border:5px solid hsl(var(--primary));box-shadow:0 2px 8px rgba(0,0,0,.3);cursor:pointer;}
        .oa-slider::-moz-range-thumb{width:26px;height:26px;border-radius:99px;background:#fff;border:5px solid hsl(var(--primary));box-shadow:0 2px 8px rgba(0,0,0,.3);cursor:pointer;}
        @keyframes oaPing{0%{transform:scale(1);opacity:.55}70%,100%{transform:scale(2.4);opacity:0}}
        @keyframes oaMsg{0%{opacity:0;transform:translateY(16px) scale(.9)}2.85%,80%{opacity:1;transform:none}82%,100%{opacity:0;transform:none}}
        @keyframes oaLink{0%,1.85%{opacity:0;transform:translateY(16px) scale(.9);animation-timing-function:ease-out}5.05%,24%{opacity:1;transform:none;animation-timing-function:linear}25.5%{opacity:1;transform:scale(.94)}26.8%,80%{opacity:1;transform:none}82%,100%{opacity:0;transform:none}}
        @keyframes oaSheet{0%,26.6%{opacity:0;transform:scale(.55);transform-origin:40% 34%}27.1%{opacity:1;transform:scale(.62);transform-origin:40% 34%;animation-timing-function:cubic-bezier(.16,.84,.32,1)}29.6%,94.5%{opacity:1;transform:scale(1);transform-origin:40% 34%}94.5%{animation-timing-function:ease-out}97%,100%{opacity:0;transform:scale(1);transform-origin:40% 34%}}
        @keyframes oaBookCard{0%,60%{opacity:1}63%,100%{opacity:0}}
        @keyframes oaBookBtn{0%,56.5%{transform:scale(1)}58%{transform:scale(.94)}59.6%,100%{transform:scale(1)}}
        @keyframes oaBookLabel{0%,57.6%{opacity:1}59.4%,100%{opacity:0}}
        @keyframes oaBookingLabel{0%,57.6%{opacity:0}59.4%,62.2%{opacity:1}64%,100%{opacity:0}}
        @keyframes oaDone{0%,61%{opacity:0}63.5%,100%{opacity:1}}
        @keyframes oaBit{0%,61.6%{opacity:0;transform:translate(0,0) scale(.2) rotate(0)}62.4%{opacity:1;transform:translate(calc(var(--x) * .7),calc(var(--y) * .35)) scale(1) rotate(35deg)}63.2%{opacity:1;transform:translate(calc(var(--x) * 1.3),var(--y)) rotate(var(--r))}66.6%{opacity:.95;transform:translate(calc(var(--x) * 1.3),calc(var(--y) + var(--d))) rotate(calc(var(--r) + 80deg))}70.6%,100%{opacity:0;transform:translate(calc(var(--x) * 1.25),calc(var(--y) + var(--d) * 1.8)) rotate(calc(var(--r) + 170deg))}}
        @keyframes oaPhoneHint{0%,35%{opacity:1}35.4%,100%{opacity:0}}
        @keyframes oaTypePhone{0%,35%{width:0}35%{animation-timing-function:steps(14,end)}41%,100%{width:13.5ch}}
        @keyframes oaNameHint{0%,42.5%{opacity:1}42.9%,100%{opacity:0}}
        @keyframes oaTypeName{0%,42.5%{width:0}42.5%{animation-timing-function:steps(9,end)}47%,100%{width:9.2ch}}
        .oaMsg{animation:oaMsg 18s infinite ease-out}
        .oaLink{animation:oaLink 18s infinite linear}
        .oaSheet{animation:oaSheet 18s infinite linear}
        .oaBookCard{animation:oaBookCard 18s infinite ease-out}
        .oaBookBtn{animation:oaBookBtn 18s infinite ease-out}
        .oaBookLabel{animation:oaBookLabel 18s infinite ease-out}
        .oaBookingLabel{animation:oaBookingLabel 18s infinite ease-out}
        .oaDone{animation:oaDone 18s infinite ease-out}
        .oaBit{animation:oaBit 18s infinite linear both}
        .oaPhoneHint{animation:oaPhoneHint 18s infinite linear}
        .oaTypePhone{animation:oaTypePhone 18s infinite linear}
        .oaNameHint{animation:oaNameHint 18s infinite linear}
        .oaTypeName{animation:oaTypeName 18s infinite linear}
        @media (prefers-reduced-motion: reduce){
          .oaMsg,.oaLink{animation:none;opacity:1;transform:none;filter:none}
          .oaSheet{animation:none;opacity:0}
          .oaBookCard,.oaBookBtn,.oaBookLabel{animation:none;opacity:1;transform:none}
          .oaDone,.oaBit,.oaBookingLabel,.oaPhoneHint,.oaNameHint{animation:none;opacity:0}
          .oaTypePhone,.oaTypeName{animation:none;width:auto}
        }
      `}</style>

      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-border bg-white/[0.86] backdrop-blur-[10px]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-3.5 sm:px-8 sm:py-4">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <LogoMark className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />
            <span className="truncate text-lg font-bold sm:text-xl">OpenAlert</span>
          </Link>
          <nav className="flex shrink-0 items-center gap-2.5 sm:gap-[22px]">
            <Link to="/merchant/login" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Sign in</Link>
            <Button asChild className="h-9 px-3 sm:h-10 sm:px-4"><Link to="/merchant/login">Start free</Link></Button>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto grid max-w-[1200px] items-center gap-11 px-5 py-14 sm:px-8 lg:grid-cols-[1.06fr_0.94fr] lg:gap-10 lg:px-6 lg:py-[72px]">
        <div className="min-w-0">
          <h1 className="m-0 mb-5 text-[clamp(30px,10.15vw,43px)] font-extrabold leading-[1.0] tracking-[-0.025em] sm:text-[53px] lg:text-[64px]">
            Turn Cancellations Into Revenue
          </h1>
          <p className="m-0 mb-7 max-w-[34em] text-[17px] leading-relaxed text-muted-foreground lg:max-w-[38em]">
            OpenAlert fills your empty slots by texting customers who want them
          </p>
          <div className="mb-8 flex w-full items-start gap-2.5 rounded-xl border border-[hsl(var(--success)/0.22)] bg-[hsl(var(--success)/0.1)] px-4 py-3 sm:inline-flex sm:w-auto sm:max-w-full">
            <DollarSign className="mt-0.5 h-[19px] w-[19px] shrink-0" />
            <span className="text-[15px] leading-snug text-foreground">Merchants recover an average of <b className="font-bold">$450/month</b></span>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-3">
            <Button asChild size="lg" className="h-[54px] flex-auto rounded-[12px] px-3 text-[15px] font-semibold shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.6)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-12px_hsl(var(--primary)/0.7)] sm:flex-none sm:px-6">
              <Link to="/merchant/login">Start 30-day free trial <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button variant="outline" size="lg" onClick={scrollToHow} className="h-[54px] flex-auto rounded-[12px] px-3 text-[15px] sm:flex-none sm:px-6">
              How it works
            </Button>
          </div>
        </div>

        {/* phone + floating widget */}
        <div className="relative flex justify-center">
          <div className="relative h-[500px] w-[248px] sm:h-[606px] sm:w-[300px]">
          <div className="absolute left-0 top-0 origin-top-left scale-[0.825] sm:scale-100">
          <div className="h-[606px] w-[300px] rounded-[46px] bg-[#1A1A1A] p-[11px] shadow-[0_30px_70px_-18px_rgba(0,0,0,.42)]">
            <div className="relative h-full w-full overflow-hidden rounded-[36px] bg-white">
              <div className="flex h-full flex-col">
                <div className="border-b border-[#F0F0F0] px-4 pb-3 pt-5 text-center">
                  <div className="mx-auto mb-1.5 h-11 w-11 overflow-hidden rounded-full">
                    <LogoMark className="h-full w-full rounded-full" alt="" />
                  </div>
                  <div className="text-[13.5px] font-semibold text-foreground">OpenAlert</div>
                </div>
                <div className="flex flex-col gap-2.5 px-3.5 py-4">
                  <div className="oaMsg max-w-[92%] self-start rounded-[18px_18px_18px_5px] bg-[#E9E9EB] px-3 py-2.5 text-[12.5px] leading-snug text-foreground">
                    Express Cuts: Sam has a 2:00 PM spot on Fri, Oct 23! Book now:
                  </div>
                  <div className="oaLink flex max-w-[92%] items-center gap-2.5 self-start rounded-2xl bg-[#E7F1FF] px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold leading-tight text-foreground">Book this time</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">openalert.org</div>
                    </div>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                    </span>
                  </div>
                </div>
                <div className="mt-auto flex items-end gap-2 px-2.5 pb-3.5 pt-1">
                  <span className="mb-0.5 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#E5E5EA] text-[#3C3C43]">
                    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  </span>
                  <div className="flex h-9 min-w-0 flex-1 items-center rounded-[18px] border border-[#D1D1D6] bg-white px-3 text-[13px] text-[#8E8E93]">
                    Text Message
                  </div>
                </div>
              </div>
              <div className="oaSheet absolute inset-0 flex flex-col bg-gradient-to-b from-white to-[#f3f4f6]">
                <div className="relative min-h-0 flex-1 pt-3">
                  <div className="flex h-full items-center px-3">
                    <div className="oaBookCard w-full rounded-lg border border-border bg-white px-3.5 py-3.5 shadow-sm">
                      <p className="m-0 text-center text-[13px] font-semibold text-foreground">Express Cuts</p>
                      <div className="mx-auto mt-2 flex w-fit items-center gap-1 rounded-full bg-[hsl(var(--success)/0.12)] px-2.5 py-1 text-[10px] font-medium text-[#2f8f3a]">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                        One spot just opened
                      </div>
                      <div className="mt-2.5 rounded-xl bg-secondary/70 px-2.5 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
                          Friday, October 23
                        </div>
                        <div className="mt-0.5 text-[16px] font-bold tracking-tight text-foreground">2:00 PM–2:30 PM</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">30 min · Sam</div>
                      </div>
                      <div className="mt-3 text-[11px] font-medium text-foreground">Phone number</div>
                      <div className="relative mt-1 h-8 rounded-md border border-border">
                        <span className="oaPhoneHint absolute inset-y-0 left-2.5 flex items-center text-[12px] text-muted-foreground">(555) 123-4567</span>
                        <span className="oaTypePhone absolute inset-y-0 left-2.5 flex items-center overflow-hidden whitespace-nowrap text-[12px] text-foreground">(555) 123-4567</span>
                      </div>
                      <div className="mt-2 text-[11px] font-medium text-foreground">Name</div>
                      <div className="relative mt-1 h-8 rounded-md border border-border">
                        <span className="oaNameHint absolute inset-y-0 left-2.5 flex items-center text-[12px] text-muted-foreground">Enter your name</span>
                        <span className="oaTypeName absolute inset-y-0 left-2.5 flex items-center overflow-hidden whitespace-nowrap text-[12px] text-foreground">Maya Chen</span>
                      </div>
                      <div className="oaBookBtn relative mt-3 overflow-hidden rounded-md bg-primary py-2 text-center text-[13px] font-semibold text-white">
                        <span className="oaBookLabel">Book Appointment</span>
                        <span className="oaBookingLabel absolute inset-0 flex items-center justify-center gap-1.5">
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                          Booking...
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="oaDone pointer-events-none absolute inset-0">
                    {[
                      ["-10px", "-16px", "20deg", "#4E8DFF", "7px", "4px", "1px", "0ms"],
                      ["16px", "-26px", "-30deg", "#FF914D", "5px", "5px", "99px", "0ms"],
                      ["-24px", "-34px", "48deg", "#4BB543", "4px", "7px", "1px", "0ms"],
                      ["6px", "-8px", "12deg", "#a855f7", "6px", "3px", "1px", "70ms"],
                      ["30px", "-14px", "-50deg", "#f472b6", "4px", "6px", "1px", "0ms"],
                      ["-38px", "-10px", "70deg", "#fbbf24", "5px", "3px", "2px", "70ms"],
                      ["20px", "-40px", "18deg", "#22c55e", "5px", "5px", "99px", "0ms"],
                      ["-8px", "-46px", "-16deg", "#60a5fa", "8px", "4px", "1px", "70ms"],
                      ["-54px", "-32px", "36deg", "#4E8DFF", "6px", "3px", "1px", "0ms"],
                      ["50px", "-38px", "-22deg", "#FF914D", "4px", "7px", "1px", "70ms"],
                      ["-42px", "-60px", "55deg", "#4BB543", "5px", "4px", "99px", "0ms"],
                      ["38px", "-66px", "14deg", "#a855f7", "7px", "3px", "1px", "0ms"],
                      ["-16px", "-70px", "-40deg", "#f472b6", "4px", "5px", "1px", "170ms"],
                      ["64px", "-20px", "62deg", "#fbbf24", "5px", "5px", "99px", "0ms"],
                      ["-72px", "-26px", "-8deg", "#60a5fa", "6px", "3px", "1px", "70ms"],
                      ["10px", "-76px", "28deg", "#22c55e", "3px", "7px", "1px", "0ms"],
                      ["-30px", "-56px", "44deg", "#FF914D", "5px", "3px", "2px", "170ms"],
                      ["56px", "-54px", "-34deg", "#4E8DFF", "4px", "6px", "1px", "70ms"],
                      ["-98px", "-18px", "24deg", "#4BB543", "6px", "3px", "1px", "0ms"],
                      ["104px", "-28px", "-46deg", "#f472b6", "4px", "5px", "99px", "70ms"],
                      ["-90px", "-56px", "16deg", "#a855f7", "5px", "4px", "1px", "0ms"],
                      ["86px", "-68px", "58deg", "#fbbf24", "7px", "3px", "1px", "170ms"],
                      ["-62px", "-86px", "-18deg", "#22c55e", "4px", "6px", "1px", "0ms"],
                      ["22px", "-98px", "32deg", "#60a5fa", "5px", "4px", "99px", "70ms"],
                      ["-112px", "-6px", "40deg", "#FF914D", "4px", "4px", "1px", "0ms"],
                      ["110px", "-10px", "-26deg", "#4E8DFF", "6px", "3px", "1px", "170ms"],
                      ["74px", "-88px", "20deg", "#4BB543", "3px", "6px", "1px", "70ms"],
                      ["-46px", "-94px", "-55deg", "#f472b6", "5px", "3px", "2px", "0ms"],
                      ["42px", "4px", "48deg", "#fbbf24", "5px", "5px", "99px", "70ms"],
                      ["-80px", "2px", "-12deg", "#a855f7", "4px", "6px", "1px", "0ms"],
                      ["-4px", "-58px", "66deg", "#22c55e", "6px", "3px", "1px", "170ms"],
                      ["68px", "-8px", "10deg", "#60a5fa", "4px", "7px", "1px", "0ms"],
                    ].map(([x, y, r, color, w, h, radius, delay], i) => (
                      <span
                        key={i}
                        className="oaBit absolute left-1/2 top-[30%] opacity-0"
                        style={{ "--x": x, "--y": y, "--r": r, "--d": `${28 + ((i * 53) % 150)}px`, background: color, width: w, height: h, borderRadius: radius, animationDelay: delay } as CSSProperties}
                      />
                    ))}
                    <div className="flex h-full items-center px-3">
                      <div className="w-full rounded-lg border border-border bg-white px-3.5 py-3 text-left shadow-sm">
                        <div className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                          <Check className="h-3.5 w-3.5" color="#16a34a" /> Appointment confirmed
                        </div>
                        <p className="m-0 mt-1 text-[12px] text-muted-foreground">You're booked with Express Cuts</p>
                        <div className="mt-2.5 flex gap-2">
                          <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
                          <div>
                            <div className="text-[11px] font-medium text-foreground">Date & Time</div>
                            <div className="text-[11px] text-muted-foreground">Friday, October 23, 2026</div>
                            <div className="text-[11px] font-medium text-muted-foreground">2:00 PM – 2:30 PM</div>
                          </div>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v6l4 2" /></svg>
                          <div>
                            <div className="text-[11px] font-medium text-foreground">Duration</div>
                            <div className="text-[11px] text-muted-foreground">30 minutes</div>
                          </div>
                        </div>
                        <div className="mt-2.5 border-t border-border pt-2.5">
                          <div className="text-[11px] text-muted-foreground">Need to make changes?</div>
                          <div className="mt-1.5 flex items-center justify-center gap-1.5 rounded-md border border-border py-1.5 text-[12px] font-medium text-foreground">
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.5-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.8 2.1z" /></svg>
                            Call Express Cuts
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="border-t border-border py-2 text-center text-[10px] text-muted-foreground">Powered by OpenAlert</div>
              </div>
            </div>
          </div>
          </div>
          </div>
          <div className="absolute -left-[26px] bottom-[54px] hidden w-[210px] rounded-2xl border border-border bg-white p-4 shadow-[0_16px_44px_-14px_rgba(0,0,0,.26)] lg:block">
            <div className="mb-0.5 flex items-center justify-between">
              <span className="text-[11.5px] font-medium text-muted-foreground">Recovered this month</span>
              <span className="rounded-full bg-[hsl(var(--success)/0.12)] px-1.5 py-[3px] text-[9.5px] font-semibold text-[#2f8f3a]">LIVE</span>
            </div>
            <div className="text-[30px] font-extrabold tracking-[-0.03em] text-foreground">$450</div>
            <div className="mt-2.5 flex h-[34px] items-end gap-[5px]">
              {[50, 34, 78, 46, 64, 100].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-[3px]" style={{ height: `${h}%`, background: i % 2 ? "hsl(var(--primary))" : "#FF914D" }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="scroll-mt-20 border-y border-border bg-secondary">
        <div className="mx-auto max-w-[1000px] px-5 py-14 sm:px-8 lg:py-20">
          <div className="mb-10 lg:mb-14">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="m-0 max-w-[16em] text-[30px] font-extrabold leading-[1.08] tracking-tight sm:text-[36px] lg:text-[42px]">Automatically text customers when there's an opening</h2>
          </div>
          <ol className="m-0 grid list-none gap-8 p-0 sm:grid-cols-3 sm:gap-10">
            {[
              "A customer cancels their appointment",
              "OpenAlert texts your waitlist",
              "Someone new books that spot",
            ].map((title, i) => (
              <li key={title} className="flex items-center gap-3 border-t border-border pt-5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(255,145,77,0.16)] text-[14px] font-semibold tabular-nums text-[#FF914D]">{i + 1}</div>
                <h3 className="m-0 text-[17px] font-semibold leading-snug tracking-tight text-foreground sm:text-[18px]">{title}</h3>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* GROW YOUR WAITLIST / QR */}
      <section>
        <div className="mx-auto max-w-[1120px] px-5 py-14 sm:px-8 lg:py-[80px]">
          <div className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div className="flex flex-col items-center gap-5">
              <img src={qrCardCounter} alt="OpenAlert Join the Waitlist sign on a counter" className="block h-auto w-full max-w-[340px] rounded-[20px] shadow-[0_24px_60px_-26px_rgba(0,0,0,.34)]" />
              <p className="m-0 w-full max-w-[340px] rounded-2xl border border-border px-4 py-3 text-[15px] font-medium italic leading-snug text-muted-foreground">
                &ldquo;Notify me if an appointment opens up in the next three days&rdquo;
              </p>
            </div>
            <div>
              <SectionLabel>Grow your waitlist</SectionLabel>
              <h2 className="m-0 mb-5 text-[32px] font-extrabold leading-[1.06] tracking-tight sm:text-[38px] lg:text-[46px]">Customers join in seconds</h2>
              <p className="m-0 mb-8 max-w-[28em] text-[17px] leading-relaxed text-muted-foreground">Put the provided QR code on your counter or share your waitlist link anywhere</p>
              <ul className="m-0 flex flex-col gap-4 p-0">
                {["No app to download", "No account to create", "Works alongside your booking software"].map((t) => (
                  <li key={t} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--success)/0.14)]"><Check className="h-3.5 w-3.5" color="#2f8f3a" /></span>
                    <span className="text-[15.5px] text-foreground">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* THE MATH */}
      <section id="math" className="bg-[#0F1729]">
        <div className="mx-auto max-w-[1080px] px-5 py-16 sm:px-8 lg:py-[96px]">
          <div className="mb-12 text-center">
            <SectionLabel tone="blue">Run your numbers</SectionLabel>
            <h2 className="mx-auto m-0 mb-4 max-w-[15em] text-[30px] font-extrabold leading-[1.12] tracking-tight text-white sm:text-[36px] lg:text-[42px]">What are cancellations actually costing you?</h2>
            <p className="mx-auto m-0 max-w-[26em] text-[15px] leading-relaxed text-white/55">Drag the sliders to match your business</p>
          </div>
          <SavingsCalculator />
          <div className="mt-[18px] text-center text-[12.5px] text-white/40">Based on a 94% average fill rate. Your results may vary.</div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="mx-auto max-w-[1120px] px-5 pt-16 pb-8 sm:px-8 sm:py-16 lg:py-[84px]">
        <div className="mb-10 text-center sm:mb-12">
          <h2 className="m-0 text-[30px] font-extrabold leading-[1.08] tracking-tight sm:text-[36px] lg:text-[42px]">Trusted by salons, spas, clinics, and more</h2>
        </div>
        <QuoteCarousel />
      </section>

      {/* FINAL CTA */}
      <section id="start" className="mx-auto max-w-[1200px] px-5 pt-8 pb-16 sm:px-8 sm:py-[96px]">
        <div className="rounded-3xl bg-primary p-8 text-center sm:p-16">
          <h2 className="mx-auto m-0 mb-9 max-w-[16em] text-[30px] font-extrabold leading-[1.14] tracking-tight text-white sm:text-[36px] lg:text-[42px]">
            Ready to stop losing revenue from cancellations?
          </h2>
          <Link to="/merchant/login" className="inline-flex max-w-full items-center justify-center gap-2.5 rounded-xl bg-white px-6 py-4 text-base font-semibold text-foreground no-underline transition-all hover:-translate-y-0.5 hover:bg-secondary hover:shadow-[0_18px_40px_-14px_rgba(0,0,0,.4)] sm:px-[34px] sm:py-[17px]">
            Start your free trial <ArrowRight className="h-[17px] w-[17px]" />
          </Link>
          <div className="mt-[18px] text-[13.5px] text-white/[0.78]">30-day free trial · Cancel anytime</div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-3.5 px-5 py-10 text-center sm:flex-row sm:px-8 sm:text-left">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-7 w-7" />
            <span className="text-base font-semibold tracking-[-0.02em] text-foreground">OpenAlert</span>
          </div>
          <div className="text-[13px] text-muted-foreground">© 2026 OpenAlert · Turn Cancellations Into Revenue</div>
        </div>
      </footer>
    </div>
  );
}
