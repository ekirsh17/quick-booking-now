import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bell, TrendingUp, Smartphone, Layers, ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { LogoMark } from "@/components/brand/LogoMark";
import notifymeIcon from "@/assets/notifyme-icon.png";

const Landing = () => {
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/20">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
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
              <Link to="/merchant/login">Start Free Trial</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-14 md:py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Turn Cancellations
            <span className="block text-primary mt-2">Into Revenue</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-4 max-w-2xl mx-auto">
            OpenAlert fills your empty slots by texting customers who want them.
          </p>
          <p className="text-base text-muted-foreground mb-8 max-w-xl mx-auto">
            Add openings by text or in the app, notify your waitlist in seconds, and keep your existing calendar workflow.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="text-lg px-8">
              <Link to="/merchant/login">Start Free Trial</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8">
              <a href="#how-it-works">See How It Works</a>
            </Button>
          </div>
          <div className="mt-6 flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-5">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                No booking-system migration
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                SMS-first for busy teams
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Setup in minutes
              </span>
            </div>
            <Link to="/consumer/sign-in" className="hover:text-foreground transition-colors underline underline-offset-4">
              Already on a waitlist? Track your notifications
            </Link>
          </div>
        </div>

        {/* Features */}
        <section id="how-it-works" className="scroll-mt-24 mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-semibold tracking-tight">How OpenAlert Works</h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              A lightweight notification layer for appointment-based businesses. Keep your current tools and fill openings faster.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6 border-border/60 shadow-sm">
              <Smartphone className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Add Openings Fast</h3>
              <p className="text-muted-foreground">
                Text "add 2pm" or use the app. OpenAlert understands timing details and creates the opening.
              </p>
            </Card>
            
            <Card className="p-6 border-border/60 shadow-sm">
              <Bell className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Notify Your Waitlist</h3>
              <p className="text-muted-foreground">
                Customers who opted in get instant SMS alerts and can tap to claim available spots.
              </p>
            </Card>
            
            <Card className="p-6 border-border/60 shadow-sm">
              <Layers className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Keep Your Current Workflow</h3>
              <p className="text-muted-foreground">
                OpenAlert works alongside your existing calendar or booking software - no platform replacement required.
              </p>
            </Card>
            
            <Card className="p-6 border-border/60 shadow-sm">
              <TrendingUp className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Measure Recovery</h3>
              <p className="text-muted-foreground">
                Use reporting to track filled openings and estimated revenue recovered from cancellations.
              </p>
            </Card>
          </div>
        </section>

        {/* Social Proof */}
        <div className="text-center py-12 bg-card rounded-lg mb-8 border border-border/60 shadow-sm">
          <p className="text-sm uppercase tracking-wide text-muted-foreground mb-2">Built for appointment-based teams</p>
          <p className="text-muted-foreground mb-4">Salons, barbershops, spas, clinics, and studios use OpenAlert to reduce lost revenue from cancellations.</p>
          <div className="flex justify-center gap-8 text-sm text-muted-foreground">
            <div>
              <div className="text-3xl font-bold text-foreground">Up to 94%</div>
              <div>Opening Fill Rate</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-foreground">$800+</div>
              <div>Monthly Revenue Recovered</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-foreground">&lt;2 min</div>
              <div>Setup Time</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">Based on early merchant outcomes; results vary by waitlist size and cancellation volume.</p>
        </div>

        {/* Testimonial */}
        <div className="text-center py-6 bg-secondary/30 rounded-lg mb-12 border border-border/40">
          <p className="text-sm text-muted-foreground italic max-w-2xl mx-auto">
            "We recovered over $3,000 in a few months from last-minute cancellations. I text 'opening at 2' and OpenAlert handles the customer notifications."
            <span className="block mt-2 font-medium text-foreground not-italic">- Salon owner, early OpenAlert user</span>
          </p>
        </div>

        <div className="text-center">
          <Button asChild size="lg" className="text-lg px-8">
            <Link to="/merchant/login" className="inline-flex items-center gap-2">
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
          <p className="text-sm text-muted-foreground mt-3">No credit card required to start.</p>
        </div>

      </div>

      {/* Footer */}
      <footer className="border-t py-12 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
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
                    Start Free Trial
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
            <div>
              <h3 className="font-semibold mb-4 text-foreground">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <img src={notifymeIcon} alt="OpenAlert" className="w-5 h-5" />
                  <span className="font-medium text-foreground">OpenAlert</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="text-center text-sm text-muted-foreground border-t pt-8">
            <p>&copy; {currentYear} OpenAlert. Turn cancellations into revenue.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
