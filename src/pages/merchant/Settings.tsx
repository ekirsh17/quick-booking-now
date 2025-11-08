import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Check } from "lucide-react";
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
  const [defaultDuration, setDefaultDuration] = useState(30);
  const [loading, setLoading] = useState(true);
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('business_name, phone, address, booking_url, require_confirmation, use_booking_system, default_opening_duration')
        .eq('id', user.id)
        .single();

      if (profile) {
        setBusinessName(profile.business_name || "");
        setPhone(profile.phone || "");
        setAddress(profile.address || "");
        setBookingUrl(profile.booking_url || "");
        setRequireConfirmation(profile.require_confirmation || false);
        setUseBookingSystem(profile.use_booking_system || false);
        setDefaultDuration(profile.default_opening_duration || 30);
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
        description: "Please enter your booking system URL.",
        variant: "destructive",
      });
      return;
    }

    // Validate URL format
    if (useBookingSystem && bookingUrl.trim()) {
      try {
        new URL(bookingUrl);
      } catch {
        toast({
          title: "Invalid URL",
          description: "Please enter a valid URL (e.g., https://example.com)",
          variant: "destructive",
        });
        return;
      }
    }

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
        default_opening_duration: defaultDuration,
      })
      .eq('id', user.id);

    if (error) {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "✅ Settings saved",
      description: "Your changes have been updated successfully.",
    });
  };

  const handleSendTestSMS = async () => {
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          to: '+15165879844',
          message: `Test from ${businessName || 'NotifyMe'}: Direct number routing ✅`,
        },
      });

      if (error) throw error;

      toast({
        title: "SMS Sent Successfully",
        description: `SID: ${data.messageSid} | Via: ${data.via || 'direct'}`,
      });
    } catch (error: any) {
      toast({
        title: "Send Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingTest(false);
    }
  };

  const handleCanaryTest = async () => {
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('sms-canary', {
        body: { to: '+15165879844' },
      });

      if (error) throw error;

      console.log('🧪 Canary result:', data);
      
      if (data.canary === 'success') {
        const isTollFree = data.from === '+18448203482';
        const message = isTollFree 
          ? `✅ Using TOLL-FREE: ${data.from}`
          : `⚠️ Using OLD NUMBER: ${data.from}\n\nYou need to update TWILIO_PHONE_NUMBER secret to: +18448203482`;
        
        alert(message);
        
        toast({
          title: isTollFree ? "✅ Toll-Free Active" : "⚠️ Using Old Number",
          description: `FROM: ${data.from} | Status: ${data.status}`,
          duration: 15000,
          variant: isTollFree ? "default" : "destructive",
        });
      } else if (data.canary === 'blocked') {
        alert('⚠️ TESTING_MODE is enabled - only verified numbers allowed');
        toast({
          title: "⚠️ Test Mode Active",
          description: "TESTING_MODE is enabled - only verified numbers allowed",
          duration: 8000,
        });
      } else {
        alert(`❌ Canary Failed: ${data.error || "Unknown error"}`);
        toast({
          title: "❌ Canary Failed",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      alert(`❌ Test Failed: ${error.message}`);
      toast({
        title: "Canary Test Failed",
        description: error.message,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <MerchantLayout>
      <div className="max-w-2xl mx-auto space-y-8 pb-32">
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
              <div className="flex gap-2 mt-1">
                <PhoneInput
                  value={phone}
                  onChange={(value) => setPhone(value || "")}
                  placeholder="(555) 123-4567"
                  className="flex-1"
                />
                <Button 
                  type="button"
                  variant="outline"
                  onClick={handleSendTestSMS}
                  disabled={sendingTest}
                >
                  {sendingTest ? 'Sending...' : 'Test SMS'}
                </Button>
                <Button 
                  type="button"
                  variant="secondary"
                  onClick={handleCanaryTest}
                  disabled={sendingTest}
                >
                  🧪 Canary
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Canary shows actual sender number | Test SMS sends to +1 516-587-9844
              </p>
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

        {/* Booking Settings with Accordion */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Booking Settings</h2>
          <p className="text-muted-foreground mb-6">
            Configure how bookings work for your business
          </p>
          
          <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>Default Appointment Duration</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Duration
                    </label>
                    <select
                      value={defaultDuration}
                      onChange={(e) => setDefaultDuration(Number(e.target.value))}
                      className="w-full md:w-64 px-3 py-2 border border-input rounded-md bg-background"
                    >
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={45}>45 minutes</option>
                      <option value={60}>60 minutes</option>
                      <option value={90}>90 minutes</option>
                      <option value={120}>120 minutes</option>
                    </select>
                    <p className="text-sm text-muted-foreground mt-2">
                      This duration will be pre-selected when creating new openings.
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger>Booking System Integration</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
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
                    <div className="pt-4 border-t">
                      <Label htmlFor="booking-url">Booking System URL *</Label>
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
                        Customers will be redirected here to complete their booking
                      </p>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger>Booking Confirmation Settings</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
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
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
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

        {/* Floating Save Button */}
        <Button 
          onClick={handleSave} 
          size="lg" 
          className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-50 shadow-2xl min-w-[200px] h-12 transition-all" 
          disabled={loading}
        >
          <Check className="mr-2 h-5 w-5" />
          Save Changes
        </Button>
      </div>
    </MerchantLayout>
  );
};

export default Settings;
