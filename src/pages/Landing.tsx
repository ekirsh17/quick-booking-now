import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bell, TrendingUp, Smartphone, Layers } from "lucide-react";
import { Link } from "react-router-dom";
import notifymeIcon from "@/assets/notifyme-icon.png";

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <img src={notifymeIcon} alt="OpenAlert" className="w-8 h-8" />
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
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Turn Cancellations
            <span className="block text-primary mt-2">Into Revenue</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-4 max-w-2xl mx-auto">
            OpenAlert fills your empty slots by texting customers who want them.
          </p>
          <p className="text-base text-muted-foreground mb-8 max-w-xl mx-auto">
            Add openings by text or in the app. Customers get notified instantly.
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
            <Smartphone className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Add Openings Your Way</h3>
            <p className="text-muted-foreground">
              Text us "add 2pm" or use the app — our AI understands and handles the rest.
            </p>
          </Card>
          
          <Card className="p-6">
            <Bell className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Instant Customer Alerts</h3>
            <p className="text-muted-foreground">
              Your waitlist gets notified immediately. They tap a link to claim the spot.
            </p>
          </Card>
          
          <Card className="p-6">
            <Layers className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Works With Your System</h3>
            <p className="text-muted-foreground">
              Not a replacement for your calendar. A lightweight layer that fills gaps.
            </p>
          </Card>
          
          <Card className="p-6">
            <TrendingUp className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Track Revenue Recovered</h3>
            <p className="text-muted-foreground">
              See exactly how many slots you've filled that would have stayed empty.
            </p>
          </Card>
        </div>

        {/* Social Proof */}
        <div className="text-center py-12 bg-card rounded-lg mb-8">
          <p className="text-muted-foreground mb-4">Trusted by salons, barbershops, spas, clinics & studios</p>
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
        <div className="text-center py-6 bg-secondary/30 rounded-lg mb-12">
          <p className="text-sm text-muted-foreground italic max-w-2xl mx-auto">
            "We've recovered $3,200 in the last 3 months from last-minute cancellations. I just text 'opening at 2' and my waitlist customers get notified instantly."
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
                  <img src={notifymeIcon} alt="OpenAlert" className="w-5 h-5" />
                  <span className="font-medium text-foreground">OpenAlert</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="text-center text-sm text-muted-foreground border-t pt-8">
            <p>&copy; 2025 OpenAlert. Turn cancellations into revenue.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
