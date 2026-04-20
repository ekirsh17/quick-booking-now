import { Link } from "react-router-dom";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, Building2, Users, CreditCard } from "lucide-react";

const SettingsHub = () => {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage business details, staff, locations, and billing.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Link
          to="/merchant/settings/business"
          aria-label="Open Business settings"
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Card className="flex h-full flex-col cursor-pointer">
            <CardHeader className="py-12">
              <div className="flex items-start justify-between gap-3">
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
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link
          to="/merchant/settings/staff-locations"
          aria-label="Open Staff and Locations settings"
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Card className="flex h-full flex-col cursor-pointer">
            <CardHeader className="py-12">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Staff & Locations</CardTitle>
                    <CardDescription>
                      Manage team members, locations, and staff seats.
                    </CardDescription>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link
          to="/merchant/billing"
          state={{ backTo: '/merchant/settings' }}
          aria-label="Open Billing settings"
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Card className="flex h-full flex-col cursor-pointer">
            <CardHeader className="py-12">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Billing</CardTitle>
                    <CardDescription>
                      Manage your subscription, staff seats, and payment method.
                    </CardDescription>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
};

export default SettingsHub;
