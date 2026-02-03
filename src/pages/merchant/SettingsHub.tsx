import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useSubscription } from "@/hooks/useSubscription";
import { useActiveLocation } from "@/hooks/useActiveLocation";
import { ArrowRight, Building2, Users, CreditCard } from "lucide-react";

const SettingsHub = () => {
  const { seatUsage, loading: seatLoading } = useSubscription();
  const { locations, loading: locationsLoading } = useActiveLocation();

  const locationCount = locations.length;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage business details, staff, locations, and billing.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex h-full flex-col">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Business Settings</CardTitle>
                <CardDescription>
                  Business identity, booking rules, working hours, and integrations.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Update how your business appears and how bookings are handled.
          </CardContent>
          <CardFooter className="mt-auto">
            <Button asChild>
              <Link to="/merchant/settings/business">
                Manage Business Settings
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="flex h-full flex-col">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Staff & Locations</CardTitle>
                <CardDescription>
                  Manage team members, locations, and seats.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>
              {seatLoading || !seatUsage
                ? "Loading seat usage..."
                : `${seatUsage.used} of ${seatUsage.total} staff seat${seatUsage.total === 1 ? "" : "s"} used`}
            </div>
            <div>
              {locationsLoading
                ? "Loading locations..."
                : `${locationCount} location${locationCount === 1 ? "" : "s"}`}
            </div>
          </CardContent>
          <CardFooter className="mt-auto">
            <Button asChild>
              <Link to="/merchant/settings/staff-locations">
                Manage Staff & Locations
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="flex h-full flex-col md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Billing</CardTitle>
                <CardDescription>
                  Manage your subscription, seats, and payment method.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Seats are purchased in Billing. Review plans or update payment details.
          </CardContent>
          <CardFooter className="mt-auto">
            <Button asChild variant="outline">
              <Link to="/merchant/billing">
                Manage Subscription
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default SettingsHub;
