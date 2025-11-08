import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Download, RefreshCw, Smartphone, Tablet, Monitor } from "lucide-react";
import MerchantLayout from "@/components/merchant/MerchantLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQRCode } from "@/hooks/useQRCode";
import { formatDistanceToNow } from "date-fns";

const QRCodePage = () => {
  const { toast } = useToast();
  const [businessName, setBusinessName] = useState("");
  const [merchantId, setMerchantId] = useState("");
  
  const { qrCode, stats, loading: qrLoading, error: qrError, regenerateQRCode } = useQRCode(merchantId);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setMerchantId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('business_name')
        .eq('id', user.id)
        .single();

      if (profile) {
        setBusinessName(profile.business_name || "");
      }
    };

    fetchProfile();
  }, []);

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

  return (
    <MerchantLayout>
      <div className="max-w-2xl mx-auto space-y-8 pb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">QR Code</h1>
          <p className="text-muted-foreground">
            Share your QR code with customers to let them join your notify list
          </p>
        </div>

        {/* QR Code Display */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <QrCode className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Your QR Code</h2>
          </div>
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
                  <img src={qrCode.image_url} alt="Business QR Code" className="w-64 h-64 mx-auto mb-4" />
                  <div className="flex gap-2 justify-center">
                    <Button onClick={handleDownloadQR}><Download className="w-4 h-4 mr-2" />Download</Button>
                    <Button variant="outline" onClick={handleRegenerateQR}><RefreshCw className="w-4 h-4 mr-2" />Regenerate</Button>
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
          {qrCode && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                Short URL: <code className="text-xs bg-background px-2 py-1 rounded">{qrCode.short_code}</code>
              </p>
            </div>
          )}
        </Card>

        {/* Analytics */}
        {stats && qrCode && (
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-4">QR Code Analytics</h3>
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
          </Card>
        )}
      </div>
    </MerchantLayout>
  );
};

export default QRCodePage;
