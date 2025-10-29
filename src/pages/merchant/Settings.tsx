import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { QrCode } from "lucide-react";
import MerchantLayout from "@/components/merchant/MerchantLayout";
import { supabase } from "@/integrations/supabase/client";

const Settings = () => {
  const { toast } = useToast();
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [requireConfirmation, setRequireConfirmation] = useState(false);
  const [useBookingSystem, setUseBookingSystem] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('business_name, phone, address, booking_url, require_confirmation, use_booking_system')
        .eq('id', user.id)
        .single();

      if (profile) {
        setBusinessName(profile.business_name || "");
        setPhone(profile.phone || "");
        setAddress(profile.address || "");
        setBookingUrl(profile.booking_url || "");
        setRequireConfirmation(profile.require_confirmation || false);
        setUseBookingSystem(profile.use_booking_system || false);
      }
      setLoading(false);
    };

    fetchProfile();
  }, []);

  const handleSave = async () => {
    // Validate booking URL if use_booking_system is enabled
    if (useBookingSystem && !bookingUrl.trim()) {
      toast({
        title: "Booking URL Required",
        description: "Please enter your booking system URL to enable third-party booking.",
        variant: "destructive",
      });
      return;
    }

    // Validate URL format
    if (bookingUrl.trim()) {
      try {
        const url = new URL(bookingUrl);
        if (!url.protocol.startsWith('http')) {
          throw new Error('URL must start with http:// or https://');
        }
      } catch {
        toast({
          title: "Invalid URL",
          description: "Please enter a valid URL starting with https:// (e.g., https://booksy.com/your-business)",
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          business_name: businessName,
          phone: phone,
          address: address,
          booking_url: useBookingSystem ? bookingUrl : null,
          require_confirmation: requireConfirmation,
          use_booking_system: useBookingSystem,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Your changes have been updated.",
      });
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
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

        {/* QR Code - Coming Soon */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Your QR Code</h2>
          <p className="text-muted-foreground mb-4">
            Customers scan this code to join your notify list
          </p>
          <div className="flex items-center justify-center bg-secondary rounded-lg p-8">
            <div className="text-center">
              <QrCode className="w-48 h-48 mx-auto mb-4 text-muted-foreground" />
              <Button disabled>Download QR Code (Coming Soon)</Button>
            </div>
          </div>
        </Card>

        {/* Booking Integration */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Booking System Integration</h2>
          
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-medium">Use External Booking System</div>
              <p className="text-sm text-muted-foreground">
                Redirect customers to your existing booking platform
              </p>
            </div>
            <Switch
              checked={useBookingSystem}
              onCheckedChange={setUseBookingSystem}
            />
          </div>

          {useBookingSystem && (
            <>
              <Separator className="my-4" />
              <div>
                <Label htmlFor="booking-url" className="flex items-center gap-1">
                  Booking System URL 
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="booking-url"
                  type="url"
                  placeholder="https://booksy.com/your-business"
                  value={bookingUrl}
                  onChange={(e) => setBookingUrl(e.target.value)}
                  className="mt-1"
                  required={useBookingSystem}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Required: Customers will be redirected to this URL to complete their booking
                </p>
              </div>
            </>
          )}
        </Card>

        {/* Booking Confirmation */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Booking Confirmation Settings</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Require Manual Confirmation</div>
              <p className="text-sm text-muted-foreground">
                Review and approve each booking request via SMS or dashboard
              </p>
            </div>
            <Switch
              checked={requireConfirmation}
              onCheckedChange={setRequireConfirmation}
            />
          </div>
        </Card>

        {/* Subscription - Coming Soon */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Subscription</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Professional Plan (Coming Soon)</div>
              <p className="text-sm text-muted-foreground">$19/month</p>
            </div>
            <Button variant="outline" disabled>Manage Billing</Button>
          </div>
        </Card>

        <Button onClick={handleSave} size="lg" className="w-full" disabled={saving || loading}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </MerchantLayout>
  );
};

export default Settings;
