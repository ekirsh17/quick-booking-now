import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bell, Calendar, MessageSquare, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary">
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
        <div className="text-center py-12 bg-card rounded-lg">
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
      </div>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>&copy; 2025 Notify. Simple last-minute booking notifications.</p>
      </footer>
    </div>
  );
};

export default Landing;
