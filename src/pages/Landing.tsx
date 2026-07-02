import { useState } from "react";
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
const X = ({ className = "h-5 w-5", color = "#C0392B" }: { className?: string; color?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);
const Star = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#FF914D" stroke="none"><path d="M12 2l2.6 6.3L21 9l-5 4.4L17.5 20 12 16.6 6.5 20 8 13.4 3 9l6.4-.7z" /></svg>
);
const DollarSign = ({ className = "h-5 w-5", color = "#2f8f3a" }: { className?: string; color?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
);

function SavingsCalculator() {
  const [ticket, setTicket] = useState(50);
  const [cancels, setCancels] = useState(4);
  const weeks = 4.3;
  const atRisk = ticket * cancels * weeks;
  const recovered = atRisk * 0.94;
  const year = round10(recovered) * 12;

  return (
    <div className="grid overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.04] md:grid-cols-2">
      {/* inputs */}
      <div className="border-b border-white/10 p-8 sm:p-10 md:border-b-0 md:border-r">
        <div className="mb-9">
          <div className="mb-4 flex items-baseline justify-between">
            <span className="text-[15px] font-medium text-white/70">Average ticket</span>
            <span className="text-[26px] font-bold tracking-tight text-white">${ticket}</span>
          </div>
          <input className="oa-slider" type="range" min={20} max={250} step={5} value={ticket} onChange={(e) => setTicket(Number(e.target.value))} />
          <div className="mt-2 flex justify-between text-[11.5px] text-white/40"><span>$20</span><span>$250</span></div>
        </div>
        <div>
          <div className="mb-4 flex items-baseline justify-between">
            <span className="text-[15px] font-medium text-white/70">Cancellations per week</span>
            <span className="text-[26px] font-bold tracking-tight text-white">{cancels} / week</span>
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
        <div className="text-[50px] font-extrabold leading-[0.95] tracking-[-0.04em] text-white sm:text-[60px] lg:text-[80px]">{money(round10(recovered))}</div>
        <div className="mt-2.5 text-base text-white/60">per month, at a 94% fill rate</div>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--success)/0.16)] px-4 py-2">
          <DollarSign className="h-4 w-4" color="#7ED991" />
          <span className="text-[13.5px] font-semibold text-[#9be8a9]">That's {money(year)} a year</span>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const scrollToHow = () => { window.location.hash = "#how"; };

  return (
    <div className="w-full overflow-x-hidden bg-white text-foreground">
      <style>{`
        .oa-slider{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:99px;background:hsl(0 0% 100% / 0.16);outline:none;cursor:pointer;}
        .oa-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:26px;height:26px;border-radius:99px;background:#fff;border:5px solid hsl(var(--primary));box-shadow:0 2px 8px rgba(0,0,0,.3);cursor:pointer;}
        .oa-slider::-moz-range-thumb{width:26px;height:26px;border-radius:99px;background:#fff;border:5px solid hsl(var(--primary));box-shadow:0 2px 8px rgba(0,0,0,.3);cursor:pointer;}
        @keyframes oaPing{0%{transform:scale(1);opacity:.55}70%,100%{transform:scale(2.4);opacity:0}}
        @keyframes oaStep1{0%,2%{opacity:0;transform:translateY(7px)}6%,93%{opacity:1;transform:translateY(0)}98%,100%{opacity:0}}
        @keyframes oaStep2{0%,20%{opacity:0;transform:translateY(7px)}24%,93%{opacity:1;transform:translateY(0)}98%,100%{opacity:0}}
        @keyframes oaStep3{0%,42%{opacity:0;transform:translateY(7px)}46%,93%{opacity:1;transform:translateY(0)}98%,100%{opacity:0}}
        @keyframes oaStep4{0%,60%{opacity:0;transform:translateY(7px) scale(.97)}66%,93%{opacity:1;transform:none}98%,100%{opacity:0}}
        .oaStep1{animation:oaStep1 7s infinite ease-out}
        .oaStep2{animation:oaStep2 7s infinite ease-out}
        .oaStep3{animation:oaStep3 7s infinite ease-out}
        .oaStep4{animation:oaStep4 7s infinite ease-out}
        @media (prefers-reduced-motion: reduce){.oaStep1,.oaStep2,.oaStep3,.oaStep4{animation:none;opacity:1;transform:none}}
      `}</style>

      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-border bg-white/[0.86] backdrop-blur-[10px]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <LogoMark className="h-8 w-8" />
            <span className="text-[19px] font-semibold tracking-[-0.02em] text-foreground">OpenAlert</span>
          </Link>
          <nav className="flex items-center gap-[22px]">
            <Link to="/merchant/login" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Sign in</Link>
            <Button asChild><Link to="/merchant/login">Start free</Link></Button>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto grid max-w-[1200px] items-center gap-11 px-5 py-14 sm:px-8 lg:grid-cols-[1.06fr_0.94fr] lg:gap-14 lg:py-[76px]">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-1.5 text-[12.5px] font-medium text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-[#4BB543]" style={{ animation: "oaPing 2.4s ease-out infinite" }} />
              <span className="relative h-2 w-2 rounded-full bg-[#4BB543]" />
            </span>
            Automatic SMS alerts for appointment businesses
          </div>
          <h1 className="m-0 mb-6 text-[40px] font-extrabold leading-[1.03] tracking-tight sm:text-5xl lg:text-[58px]">
            Your 2 o'clock just canceled.
            <span className="mt-1.5 block text-primary">Your waitlist already knows.</span>
          </h1>
          <p className="m-0 mb-6 max-w-[32em] text-lg leading-relaxed text-[#525252]">
            OpenAlert is the SMS waitlist for appointment businesses. When a client cancels, we text everyone waiting, and the opening fills itself. You don't lift a finger.
          </p>
          <div className="mb-[30px] inline-flex items-center gap-2.5 rounded-xl border border-[hsl(var(--success)/0.22)] bg-[hsl(var(--success)/0.1)] px-4 py-3">
            <DollarSign className="h-[19px] w-[19px]" />
            <span className="text-[15px] leading-snug text-foreground">Merchants recover an average of <b className="font-bold">$800/month</b> in otherwise-lost appointments</span>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild size="lg" className="h-[52px] rounded-[11px] px-6 text-[15px]">
              <Link to="/merchant/login">Start free <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button variant="ghost" size="lg" onClick={scrollToHow} className="h-[52px] rounded-[11px] border border-border px-5 text-[15px]">
              See how it works
            </Button>
          </div>
          <div className="mt-[18px] text-[13.5px] text-muted-foreground">30-day free trial · Easy setup · Cancel anytime</div>
        </div>

        {/* phone + floating widget */}
        <div className="relative flex justify-center">
          <div className="relative h-[606px] w-[300px] rounded-[46px] bg-[#1A1A1A] p-[11px] shadow-[0_30px_70px_-18px_rgba(0,0,0,.42)]">
            <div className="relative h-full w-full overflow-hidden rounded-[36px] bg-white">
              <div className="absolute left-1/2 top-0 z-[2] h-[26px] w-[120px] -translate-x-1/2 rounded-b-[16px] bg-[#1A1A1A]" />
              <div className="border-b border-[#F0F0F0] px-4 pb-3 pt-[30px] text-center">
                <div className="mx-auto mb-1.5 flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[#DCEAFF] text-sm font-bold text-primary">EC</div>
                <div className="text-[13.5px] font-semibold text-foreground">Express Cuts</div>
                <div className="text-[11px] text-muted-foreground">Text message</div>
              </div>
              <div className="flex flex-col gap-[11px] px-[15px] py-5">
                <div className="oaStep1 inline-flex items-center gap-1.5 self-center rounded-full border border-[#ECECEC] bg-secondary px-3 py-1.5 text-[11px] text-muted-foreground">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></svg>
                  Your 2:00 PM just opened up
                </div>
                <div className="oaStep2 max-w-[84%] self-start rounded-[17px_17px_17px_5px] bg-[#F2F2F4] px-[13px] py-[11px] text-[12.5px] leading-snug text-foreground">Express Cuts: a 2:00 PM spot just opened today. Tap to grab it: <span className="text-primary">openalert.org/x7Kp</span></div>
                <div className="oaStep2 self-center text-[10px] text-[#bdbdbd]">Delivered · 12:47 PM</div>
                <div className="oaStep3 max-w-[74%] self-end rounded-[17px_17px_5px_17px] bg-primary px-[13px] py-[11px] text-[12.5px] leading-snug text-white">Yes! Booking it now</div>
                <div className="oaStep4 mt-0.5 inline-flex items-center gap-1.5 self-center rounded-full bg-[hsl(var(--success)/0.13)] px-[13px] py-[7px] text-[11.5px] font-semibold text-[#2f8f3a]">
                  <Check className="h-3 w-3" color="#4BB543" /> Rebooked · +$60 recovered
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -left-[26px] bottom-[54px] hidden w-[210px] rounded-2xl border border-border bg-white p-4 shadow-[0_16px_44px_-14px_rgba(0,0,0,.26)] lg:block">
            <div className="mb-0.5 flex items-center justify-between">
              <span className="text-[11.5px] font-medium text-muted-foreground">Recovered this month</span>
              <span className="rounded-full bg-[hsl(var(--success)/0.12)] px-1.5 py-[3px] text-[9.5px] font-semibold text-[#2f8f3a]">LIVE</span>
            </div>
            <div className="text-[30px] font-extrabold tracking-[-0.03em] text-foreground">$800</div>
            <div className="mt-2.5 flex h-[34px] items-end gap-[5px]">
              {[50, 34, 78, 46, 64, 100].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-[3px]" style={{ height: `${h}%`, background: i % 2 ? "hsl(var(--primary))" : "#FF914D" }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="border-y border-border bg-secondary">
        <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8 lg:py-[84px]">
          <div className="mb-13 text-center">
            <div className="mb-3 text-[12.5px] font-bold uppercase tracking-[0.09em] text-primary">How it works</div>
            <h2 className="m-0 text-[28px] font-extrabold tracking-tight sm:text-[34px] lg:text-[40px]">A client cancels. Your waitlist fills the gap</h2>
          </div>
          <div className="grid items-center gap-4 lg:grid-cols-[1fr_48px_1fr_48px_1fr] lg:gap-0">
            {/* step 1 */}
            <div className="rounded-2xl border border-border bg-white p-[26px] shadow-[0_1px_3px_rgba(0,0,0,.05)]">
              <div className="mb-[18px] flex items-center gap-2.5">
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-border bg-secondary text-[12.5px] font-bold text-muted-foreground">1</span>
                <span className="rounded-full bg-[hsl(25_95%_64%/0.14)] px-2.5 py-1 text-[11px] font-semibold text-[#F97316]">Opening</span>
              </div>
              <div className="mb-[18px] flex items-center justify-between rounded-[11px] border border-border bg-secondary p-3.5">
                <div><div className="text-sm font-semibold text-foreground">Today · 2:00 PM</div><div className="mt-0.5 text-xs text-muted-foreground">60 min · with Mike</div></div>
                <X className="h-5 w-5" color="#F97316" />
              </div>
              <h3 className="m-0 mb-1.5 text-[19px] font-bold tracking-tight text-foreground">An opening appears</h3>
              <p className="m-0 text-sm leading-relaxed text-muted-foreground">A client cancels in your booking software. OpenAlert catches the opening. No action needed from you.</p>
            </div>
            <div className="hidden justify-center text-[#C4C4C4] lg:flex"><ArrowRight className="h-6 w-6" /></div>
            {/* step 2 */}
            <div className="rounded-2xl border border-border bg-white p-[26px] shadow-[0_1px_3px_rgba(0,0,0,.05)]">
              <div className="mb-[18px] flex items-center gap-2.5">
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-border bg-secondary text-[12.5px] font-bold text-muted-foreground">2</span>
                <span className="rounded-full bg-primary/[0.14] px-2.5 py-1 text-[11px] font-semibold text-primary">38 texted</span>
              </div>
              <div className="mb-2 rounded-[11px] border border-border bg-white px-[13px] py-3"><div className="text-xs leading-normal text-foreground">Express Cuts: a 2:00 PM spot just opened today. Tap to book: <span className="text-primary">openalert.org/x7Kp</span></div></div>
              <div className="mb-3.5 text-right text-[11px] text-muted-foreground">Delivered · 12:47 PM</div>
              <h3 className="m-0 mb-1.5 text-[19px] font-bold tracking-tight text-foreground">Everyone waiting gets the text</h3>
              <p className="m-0 text-sm leading-relaxed text-muted-foreground">Everyone watching that day is texted at once. No call-downs, no group chats, no Instagram stories.</p>
            </div>
            <div className="hidden justify-center text-[#C4C4C4] lg:flex"><ArrowRight className="h-6 w-6" /></div>
            {/* step 3 */}
            <div className="rounded-2xl border border-[hsl(var(--success)/0.4)] bg-white p-[26px] shadow-[0_8px_30px_-10px_hsl(var(--success)/0.3)]">
              <div className="mb-[18px] flex items-center gap-2.5">
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[hsl(var(--success)/0.14)] text-[12.5px] font-bold text-[#2f8f3a]">3</span>
                <span className="rounded-full bg-[hsl(var(--success)/0.14)] px-2.5 py-1 text-[11px] font-semibold text-[#2f8f3a]">Filled</span>
              </div>
              <div className="mb-[18px] flex items-center gap-2.5 rounded-[11px] border border-[hsl(var(--success)/0.25)] bg-[hsl(var(--success)/0.08)] p-3.5">
                <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#DCEAFF] text-[12.5px] font-bold text-primary">JD</div>
                <div className="flex-1"><div className="text-[13.5px] font-semibold text-foreground">Jordan D. · 2:00 PM</div><div className="text-xs font-semibold text-[#2f8f3a]">+$60 recovered</div></div>
                <Check className="h-[22px] w-[22px]" color="#4BB543" />
              </div>
              <h3 className="m-0 mb-1.5 text-[19px] font-bold tracking-tight text-foreground">Someone books it</h3>
              <p className="m-0 text-sm leading-relaxed text-muted-foreground">First to tap books it through your normal booking flow. The chair stays full.</p>
            </div>
          </div>
          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-3">
              <svg className="h-[30px] w-[30px]" viewBox="0 0 24 24" fill="none" stroke="#2f8f3a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
              <span className="text-[34px] font-extrabold tracking-tight text-[#2f8f3a]">Booked</span>
            </div>
            <div className="mt-2 text-[15px] text-muted-foreground">The opening fills itself while you keep working. No scramble, no phone calls.</div>
          </div>
        </div>
      </section>

      {/* WHY IT'S DIFFERENT */}
      <section className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8 lg:py-[88px]">
        <div className="mb-13 text-center">
          <div className="mb-3 text-[12.5px] font-bold uppercase tracking-[0.09em] text-primary">Why it's different</div>
          <h2 className="m-0 mb-3 text-[28px] font-extrabold tracking-tight sm:text-[34px] lg:text-[40px]">You're already doing this by hand</h2>
          <p className="mx-auto m-0 max-w-[34em] text-[17px] leading-relaxed text-muted-foreground">Every time a client cancels, you scramble to fill it. OpenAlert handles it, every time.</p>
        </div>
        <div className="grid items-stretch gap-6 md:grid-cols-2">
          {/* WITHOUT */}
          <div className="rounded-[18px] border border-border bg-secondary p-[34px]">
            <div className="mb-[22px] text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Without OpenAlert</div>
            <div className="flex flex-col gap-4">
              {["Text a few regulars", "Post on Instagram", "Call around between clients", "Wait, and hope"].map((t) => (
                <div key={t} className="flex items-center gap-3.5"><span className="opacity-55"><X className="h-[22px] w-[22px]" /></span><span className="text-base text-[#525252]">{t}</span></div>
              ))}
            </div>
            <div className="mt-7 flex items-center gap-3 border-t border-[#E0E0E0] pt-[22px]">
              <svg className="h-[26px] w-[26px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="#9b9b9b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="12" x="3" y="6" rx="2" /><path d="M3 10h18" /></svg>
              <span className="text-[23px] font-bold tracking-tight text-[#9b9b9b]">The chair stays empty</span>
            </div>
          </div>
          {/* WITH */}
          <div className="rounded-[18px] border-[1.5px] border-primary bg-white p-[34px] shadow-[0_16px_50px_-18px_hsl(var(--primary)/0.45)]">
            <div className="mb-[22px] flex items-center gap-2.5">
              <div className="flex h-[22px] w-[22px] items-center justify-center rounded-md bg-primary"><LogoMark className="h-3 w-3 text-white" /></div>
              <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-primary">With OpenAlert</span>
            </div>
            <div className="flex flex-col gap-4">
              {["Cancellation detected", "Everyone notified at once", "First person books", "You did nothing"].map((t) => (
                <div key={t} className="flex items-center gap-3.5"><Check className="h-[22px] w-[22px] shrink-0" /><span className="text-base text-foreground">{t}</span></div>
              ))}
            </div>
            <div className="mt-7 flex items-center gap-3 border-t border-[hsl(var(--success)/0.25)] pt-[22px]">
              <Check className="h-[30px] w-[30px] shrink-0" />
              <span className="text-[30px] font-extrabold tracking-[-0.02em] text-[#2f8f3a]">The chair stays full</span>
            </div>
          </div>
        </div>
      </section>

      {/* GROW YOUR WAITLIST / QR */}
      <section className="border-y border-border bg-secondary">
        <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8 lg:py-[88px]">
          <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div className="flex justify-center">
              <div className="w-full max-w-[360px] overflow-hidden rounded-[20px] shadow-[0_30px_72px_-22px_rgba(0,0,0,.42)]">
                <img src={qrCardCounter} alt="OpenAlert Join the Waitlist sign on a counter" className="block h-auto w-full" />
              </div>
            </div>
            <div>
              <div className="mb-3.5 text-[12.5px] font-bold uppercase tracking-[0.09em] text-primary">Grow your waitlist</div>
              <h2 className="m-0 mb-4.5 text-[32px] font-extrabold leading-[1.08] tracking-tight sm:text-[38px] lg:text-[44px]">Customers add<br />themselves</h2>
              <p className="m-0 mb-7 max-w-[33em] text-[17px] leading-relaxed text-[#525252]">Put a QR card on your counter or share a link anywhere. Customers join your waitlist right there. No app, no account.</p>
              <div className="mb-7 grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-[13px] border border-border bg-white px-4 py-[18px]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-primary/[0.12]"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="#4E8DFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M7 7h.01" /><path d="M7 12h.01" /><path d="M12 7h5" /><path d="M12 12h5" /><path d="M7 17h10" /></svg></div>
                  <div><div className="text-[13.5px] font-semibold text-foreground">QR card</div><div className="mt-0.5 text-xs leading-snug text-muted-foreground">On your counter</div></div>
                </div>
                <div className="flex items-center gap-3 rounded-[13px] border border-border bg-white px-4 py-[18px]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-primary/[0.12]"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="#4E8DFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg></div>
                  <div><div className="text-[13.5px] font-semibold text-foreground">Shareable link</div><div className="mt-0.5 text-xs leading-snug text-muted-foreground">Text, DM, site, or socials</div></div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {["Works alongside your booking software", "No app required for customers", "Takes seconds to join"].map((t) => (
                  <div key={t} className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-[15px] py-2.5"><Check className="h-4 w-4" /><span className="text-[13.5px] font-medium text-foreground">{t}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THE MATH */}
      <section id="math" className="bg-[#0F1729]">
        <div className="mx-auto max-w-[1100px] px-5 py-16 sm:px-8 lg:py-[92px]">
          <div className="mb-12 text-center">
            <div className="mb-3.5 text-[12.5px] font-bold uppercase tracking-[0.09em] text-[#6EA4FF]">Run your numbers</div>
            <h2 className="mx-auto m-0 mb-3.5 max-w-[18em] text-[28px] font-extrabold tracking-tight text-white sm:text-[34px] lg:text-[40px]">Last-minute cancellations quietly cost the average appointment business thousands a month</h2>
            <p className="mx-auto m-0 max-w-[30em] text-[17px] leading-relaxed text-white/60">Drag the sliders to match your business</p>
          </div>
          <SavingsCalculator />
          <div className="mt-[18px] text-center text-[12.5px] text-white/40">Based on a 94% average fill rate. Your results will vary.</div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8 lg:py-[88px]">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { q: "A no-show used to mean a dead hour. Now the opening's usually gone before I've finished sweeping up.", n: "Kenji", r: "Barber · Brooklyn, NY", i: "K", bg: "#DCEAFF", fg: "text-primary" },
            { q: "I stopped chasing people in my group chat. The chair just refills on its own now.", n: "Marisol", r: "Salon owner · Austin, TX", i: "M", bg: "hsl(25 95% 64% / 0.18)", fg: "text-[#F97316]" },
            { q: "Set it up between two clients. It runs quietly in the background and the front desk loves it.", n: "Dana", r: "Med-spa · Portland, OR", i: "D", bg: "#DCEAFF", fg: "text-primary" },
          ].map((t) => (
            <div key={t.n} className="flex flex-col rounded-2xl border border-border p-7">
              <div className="mb-4 flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} />)}</div>
              <p className="m-0 mb-[22px] flex-1 text-[15.5px] leading-relaxed text-foreground">"{t.q}"</p>
              <div className="flex items-center gap-2.5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${t.fg}`} style={{ background: t.bg }}>{t.i}</div>
                <div><div className="text-sm font-semibold text-foreground">{t.n}</div><div className="text-[12.5px] text-muted-foreground">{t.r}</div></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section id="start" className="mx-auto max-w-[1200px] px-5 pb-[88px] sm:px-8">
        <div className="rounded-3xl bg-primary p-10 text-center sm:p-16">
          <h2 className="mx-auto m-0 mb-4 max-w-[18em] text-[28px] font-extrabold leading-[1.22] text-white sm:text-[34px] lg:text-[40px]">
            The next time someone cancels, you won't reach for your phone.<br />
            <span className="text-white/70">OpenAlert already did</span>
          </h2>
          <p className="mx-auto m-0 mb-8 max-w-[30em] text-[17px] leading-relaxed text-white/90">Turn it on today and stop writing off empty chairs</p>
          <Link to="/merchant/login" className="inline-flex items-center gap-2.5 rounded-xl bg-white px-[34px] py-[17px] text-base font-semibold text-foreground no-underline transition-colors hover:bg-secondary">
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
          <div className="text-[13px] text-muted-foreground">© 2026 OpenAlert · Recover canceled revenue automatically</div>
        </div>
      </footer>
    </div>
  );
}
