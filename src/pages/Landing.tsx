import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { LogoMark } from "@/components/brand/LogoMark";
import qrStandLifestyle from "@/assets/screenshots/qr-stand-lifestyle.png";
import merchantOpeningsDesktop from "@/assets/screenshots/merchant-openings-desktop.png";
import consumerClaimMobile from "@/assets/screenshots/consumer-claim-mobile.png";
import qrStandFlat from "@/assets/screenshots/qr-stand-flat.png";
import consumerWaitlistFormMobile from "@/assets/screenshots/consumer-waitlist-form-mobile.png";
import merchantReportingDesktop from "@/assets/screenshots/merchant-reporting-desktop.png";

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary">
      {/* Nav */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <LogoMark className="w-8 h-8" />
            <span className="font-bold text-xl">OpenAlert</span>
          </Link>

          <nav className="flex items-center gap-3">
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link to="/merchant/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link to="/merchant/login">Start Free — 30 Days</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h1 className="text-5xl md:text-6xl font-bold">
              Your cancelled appointments
              <span className="block text-primary mt-2">don&apos;t have to cost you.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mt-4">
              OpenAlert texts your waitlist the moment a spot opens. They tap, it&apos;s booked — in minutes.
            </p>
            <a
              href="#how-it-works"
              className="inline-block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors mt-4"
            >
              See how it works
            </a>
            <div className="mt-6">
              <Button asChild size="lg" className="w-full md:w-auto">
                <Link to="/merchant/login">Start Free — 30 Days</Link>
              </Button>
              <p className="text-xs text-muted-foreground text-center md:text-left mt-2">
                Card required. Cancel anytime.
              </p>
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden bg-gray-50 max-w-sm mx-auto md:max-w-none md:mx-0">
            <img
              src={qrStandLifestyle}
              alt="OpenAlert QR code stand on a salon counter"
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* Industry stat */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-2xl text-center">
          <p className="text-xl font-medium text-foreground">
            Appointment businesses lose 10–20% of booked revenue to last-minute cancellations every month.
          </p>
          <p className="text-xl text-muted-foreground mt-2">
            Those slots don&apos;t have to stay empty.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="container mx-auto px-4 py-16">
        <p className="text-sm font-semibold text-primary uppercase tracking-widest">How it works</p>
        <h2 className="text-3xl font-bold mt-2">A cancellation becomes a booking in minutes.</h2>

        <div className="grid gap-8 md:grid-cols-3 mt-12">
          <div>
            <p className="text-5xl font-bold text-primary/20">01</p>
            <h3 className="text-lg font-semibold mt-2">A spot opens</h3>
            <p className="text-sm text-muted-foreground mt-1">
              You add an opening — by text, in the app, or automatically when a cancellation email arrives.
            </p>
            <div className="bg-gray-50 rounded-2xl p-3 mt-4">
              <img
                src={merchantOpeningsDesktop}
                alt="Merchant openings dashboard showing open appointment slots"
                className="rounded-xl overflow-hidden w-full"
              />
            </div>
          </div>

          <div>
            <p className="text-5xl font-bold text-primary/20">02</p>
            <h3 className="text-lg font-semibold mt-2">Your waitlist gets a text</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Everyone on your waitlist gets an SMS instantly. First to tap wins the spot.
            </p>
            <div className="bg-gray-50 rounded-2xl p-4 mt-4 flex flex-col">
              <p className="text-xs text-muted-foreground text-center mb-2">Text message</p>
              <div className="bg-[#1982FC] text-white text-sm rounded-2xl rounded-bl-sm px-4 py-3 max-w-[85%] self-start leading-relaxed">
                New opening at Express Cuts — Thu Jun 12, 2:00 PM. Tap to claim before it&apos;s gone:
                openalert.org/claim/...
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">Delivered</p>
            </div>
          </div>

          <div>
            <p className="text-5xl font-bold text-primary/20">03</p>
            <h3 className="text-lg font-semibold mt-2">They tap and book</h3>
            <p className="text-sm text-muted-foreground mt-1">
              The customer taps the link, enters their name and number, and the slot is theirs.
            </p>
            <div className="bg-gray-50 rounded-2xl p-3 mt-4">
              <img
                src={consumerClaimMobile}
                alt="Consumer mobile booking page to claim an open appointment"
                className="max-w-[220px] mx-auto rounded-xl overflow-hidden shadow-sm"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Physical setup */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-semibold text-primary uppercase tracking-widest">Setup</p>
            <h2 className="text-2xl font-bold mt-2">Set up in minutes. Your counter does the rest.</h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              Print your QR code, slip it into a stand at your counter, and every walk-in can join your
              waitlist. No app to download. No account required.
            </p>
          </div>
          <div className="flex flex-col items-center gap-4 md:flex-row md:items-end">
            <img
              src={qrStandFlat}
              alt="Printable OpenAlert waitlist QR code card"
              className="max-w-[200px] w-full md:w-1/2 rounded-xl overflow-hidden bg-gray-50"
            />
            <img
              src={consumerWaitlistFormMobile}
              alt="Consumer waitlist signup form on mobile"
              className="max-w-[180px] w-full md:w-1/2 rounded-xl overflow-hidden shadow-sm"
            />
          </div>
        </div>
      </section>

      {/* Proof */}
      <section className="container mx-auto px-4 py-16">
        <p className="text-sm font-semibold text-primary uppercase tracking-widest text-center">
          The dashboard
        </p>
        <h2 className="text-2xl font-bold text-center mt-2">Track every slot you filled.</h2>
        <p className="text-center text-muted-foreground mt-2 max-w-xl mx-auto">
          See openings booked, revenue recovered, and notifications sent — all in one place.
        </p>
        <div className="bg-gray-50 rounded-2xl p-4 mt-8 w-full">
          <img
            src={merchantReportingDesktop}
            alt="Merchant reporting dashboard with bookings and revenue metrics"
            className="rounded-xl overflow-hidden w-full"
          />
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-primary py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white">Stop losing revenue to empty slots.</h2>
          <p className="text-lg text-white/80 mt-3">
            Free for 30 days. No setup fees. Cancel anytime.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-8 mx-auto block w-full md:w-auto bg-white text-primary hover:bg-white/90"
          >
            <Link to="/merchant/login">Start Free — 30 Days</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="font-semibold mb-4 text-foreground">For Merchants</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link to="/merchant/login" className="hover:text-foreground transition-colors">
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link to="/merchant/login" className="hover:text-foreground transition-colors">
                    Start Free — 30 Days
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-foreground">For Customers</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link to="/consumer/sign-in" className="hover:text-foreground transition-colors">
                    Track Your Notifications
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-foreground">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#how-it-works" className="hover:text-foreground transition-colors">
                    How It Works
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="text-center text-sm text-muted-foreground border-t pt-8">
            <p>&copy; 2026 OpenAlert. Turn cancellations into revenue.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
