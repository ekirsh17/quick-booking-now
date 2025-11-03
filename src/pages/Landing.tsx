import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bell, Calendar, MessageSquare, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import notifymeIcon from "@/assets/notifyme-icon.png";

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <img src={notifymeIcon} alt="NotifyMe" className="w-8 h-8" />
            <span className="font-bold text-xl">NotifyMe</span>
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
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Fill Last-Minute Cancellations
            <span className="block text-primary mt-2">Automatically</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Turn empty appointment slots into revenue. Notify interested customers instantly when openings appear.
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild size="lg" className="text-lg px-8">
              <Link to="/merchant/login">Start Free Trial</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8">
              <Link to="#how-it-works">How It Works</Link>
            </Button>
          </div>
        </div>

        {/* Features */}
        <div id="how-it-works" className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="p-6">
            <Bell className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Instant Notifications</h3>
            <p className="text-muted-foreground">
              SMS alerts sent immediately when slots open. No app required.
            </p>
          </Card>
          
          <Card className="p-6">
            <Calendar className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Quick Setup</h3>
            <p className="text-muted-foreground">
              Add openings in seconds. Customers scan your QR to join.
            </p>
          </Card>
          
          <Card className="p-6">
            <MessageSquare className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Zero Friction</h3>
            <p className="text-muted-foreground">
              No accounts needed. Simple name and phone. Book in 3 taps.
            </p>
          </Card>
          
          <Card className="p-6">
            <TrendingUp className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Track Revenue</h3>
            <p className="text-muted-foreground">
              See exactly how much revenue you've recovered.
            </p>
          </Card>
        </div>

        {/* Social Proof */}
        <div className="text-center py-12 bg-card rounded-lg mb-8">
          <p className="text-muted-foreground mb-4">Trusted by barbers, salons, and service providers</p>
          <div className="flex justify-center gap-8 text-sm text-muted-foreground">
            <div>
              <div className="text-3xl font-bold text-foreground">94%</div>
              <div>Fill Rate</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-foreground">$800</div>
              <div>Avg. Monthly Recovery</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-foreground">&lt;2min</div>
              <div>Setup Time</div>
            </div>
          </div>
        </div>

        {/* Testimonial */}
        <div className="text-center py-6 bg-secondary/30 rounded-lg">
          <p className="text-sm text-muted-foreground italic max-w-2xl mx-auto">
            "We've recovered $3,200 in the last 3 months from last-minute cancellations. The SMS notifications work perfectly and customers love how easy it is to book."
            <span className="block mt-2 font-medium text-foreground not-italic">— Sarah M., Salon Owner</span>
          </p>
        </div>
      </div>

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
                  <img src={notifymeIcon} alt="NotifyMe" className="w-5 h-5" />
                  <span className="font-medium text-foreground">NotifyMe</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="text-center text-sm text-muted-foreground border-t pt-8">
            <p>&copy; 2025 NotifyMe. Simple last-minute booking notifications.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
