import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { QrCode } from "lucide-react";
import MerchantLayout from "@/components/merchant/MerchantLayout";

const Settings = () => {
  const { toast } = useToast();
  const [businessName, setBusinessName] = useState("Evan's Barbershop");
  const [phone, setPhone] = useState("(555) 123-4567");
  const [address, setAddress] = useState("123 Main St, City, ST 12345");
  const [bookingUrl, setBookingUrl] = useState("");
  const [requireConfirmation, setRequireConfirmation] = useState(false);

  const handleSave = () => {
    // TODO: Save to backend when Cloud is enabled
    toast({
      title: "Settings saved",
      description: "Your changes have been updated.",
    });
  };

  return (
    <MerchantLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Manage your business details and preferences
          </p>
        </div>

        {/* Business Information */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Business Information</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="business-name">Business Name</Label>
              <Input
                id="business-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </Card>

        {/* QR Code */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Your QR Code</h2>
          <p className="text-muted-foreground mb-4">
            Customers scan this code to join your notify list
          </p>
          <div className="flex items-center justify-center bg-secondary rounded-lg p-8">
            <div className="text-center">
              <QrCode className="w-48 h-48 mx-auto mb-4 text-muted-foreground" />
              <Button>Download QR Code</Button>
            </div>
          </div>
        </Card>

        {/* Booking Integration */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Booking System Integration</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Optional: Connect your existing booking system (Booksy, Square, Calendly, etc.)
          </p>
          <div>
            <Label htmlFor="booking-url">Booking System URL</Label>
            <Input
              id="booking-url"
              type="url"
              placeholder="https://booksy.com/your-business"
              value={bookingUrl}
              onChange={(e) => setBookingUrl(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Customers will be redirected here to complete their booking
            </p>
          </div>
        </Card>

        {/* Preferences */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Preferences</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Require Manual Confirmation</div>
              <p className="text-sm text-muted-foreground">
                Get SMS confirmation request for each booking
              </p>
            </div>
            <Switch
              checked={requireConfirmation}
              onCheckedChange={setRequireConfirmation}
            />
          </div>
        </Card>

        {/* Subscription */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Subscription</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Professional Plan</div>
              <p className="text-sm text-muted-foreground">$19/month</p>
            </div>
            <Button variant="outline">Manage Billing</Button>
          </div>
        </Card>

        <Button onClick={handleSave} size="lg" className="w-full">
          Save Changes
        </Button>
      </div>
    </MerchantLayout>
  );
};

export default Settings;
