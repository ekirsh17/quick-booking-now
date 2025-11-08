import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Download, RefreshCw, Smartphone, Tablet, Monitor } from "lucide-react";
import MerchantLayout from "@/components/merchant/MerchantLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQRCode } from "@/hooks/useQRCode";
import { formatDistanceToNow } from "date-fns";

const Settings = () => {
  const { toast } = useToast();
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [requireConfirmation, setRequireConfirmation] = useState(false);
  const [useBookingSystem, setUseBookingSystem] = useState(false);
  const [loading, setLoading] = useState(true);
  const [merchantId, setMerchantId] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  
  const { qrCode, stats, loading: qrLoading, error: qrError, regenerateQRCode } = useQRCode(merchantId);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setMerchantId(user.id);

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
      title: "Settings saved",
      description: "Your changes have been updated.",
    });
  };

  const handleDownloadQR = () => {
    if (!qrCode?.image_url) return;

    const link = document.createElement('a');
    link.download = `${businessName || 'business'}-qr-code.png`;
    link.href = qrCode.image_url;
    link.target = '_blank';
    link.click();

    toast({
      title: "QR Code Downloaded",
      description: "Your QR code has been saved.",
    });
  };

  const handleRegenerateQR = async () => {
    if (!confirm('Generate a new QR code? The old QR code will be deactivated.')) {
      return;
    }

    await regenerateQRCode();
    
    toast({
      title: "QR Code Regenerated",
      description: "A new QR code has been created.",
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

        {/* QR Code */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Your QR Code</h2>
          <p className="text-muted-foreground mb-4">
            Customers scan this code to join your notify list. This QR code is persistent and will always work.
          </p>
          <div className="flex items-center justify-center bg-secondary rounded-lg p-8 mb-4">
            <div className="text-center">
              {qrLoading ? (
                <>
                  <QrCode className="w-48 h-48 mx-auto mb-4 text-muted-foreground animate-pulse" />
                  <p className="text-sm text-muted-foreground">Generating QR code...</p>
                </>
              ) : qrError ? (
                <>
                  <QrCode className="w-48 h-48 mx-auto mb-4 text-destructive" />
                  <p className="text-sm text-destructive">{qrError}</p>
                </>
              ) : qrCode?.image_url ? (
                <>
                  <img 
                    src={qrCode.image_url} 
                    alt="Business QR Code" 
                    className="w-64 h-64 mx-auto mb-4"
                  />
                  <div className="flex gap-2 justify-center">
                    <Button onClick={handleDownloadQR}>
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                    <Button variant="outline" onClick={handleRegenerateQR}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Regenerate
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <QrCode className="w-48 h-48 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No QR code available</p>
                </>
              )}
            </div>
          </div>

          {/* QR Analytics */}
          {stats && qrCode && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-semibold mb-4">QR Code Analytics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-secondary/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold">{stats.total_scans}</div>
                  <div className="text-sm text-muted-foreground">Total Scans</div>
                </div>
                <div className="bg-secondary/50 rounded-lg p-4 text-center">
                  <Smartphone className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-lg font-semibold">{stats.mobile_scans}</div>
                  <div className="text-xs text-muted-foreground">Mobile</div>
                </div>
                <div className="bg-secondary/50 rounded-lg p-4 text-center">
                  <Tablet className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-lg font-semibold">{stats.tablet_scans}</div>
                  <div className="text-xs text-muted-foreground">Tablet</div>
                </div>
                <div className="bg-secondary/50 rounded-lg p-4 text-center">
                  <Monitor className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-lg font-semibold">{stats.desktop_scans}</div>
                  <div className="text-xs text-muted-foreground">Desktop</div>
                </div>
              </div>
              {stats.last_scanned_at && (
                <p className="text-sm text-muted-foreground text-center mt-4">
                  Last scanned {formatDistanceToNow(new Date(stats.last_scanned_at), { addSuffix: true })}
                </p>
              )}
            </div>
          )}

          {qrCode && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                Short URL: <code className="text-xs bg-background px-2 py-1 rounded">{qrCode.short_code}</code>
              </p>
            </div>
          )}
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
              <div className="my-4 border-t" />
              <div>
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
