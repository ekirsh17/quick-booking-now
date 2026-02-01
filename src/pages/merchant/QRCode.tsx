import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Download, RefreshCw, Smartphone, Tablet, Monitor } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQRCode } from "@/hooks/useQRCode";
import { formatDistanceToNow } from "date-fns";
import { useEntitlements } from "@/hooks/useEntitlements";
import { Link } from "react-router-dom";

const QRCodePage = () => {
  const { toast } = useToast();
  const entitlements = useEntitlements();
  const [businessName, setBusinessName] = useState("");
  const [merchantId, setMerchantId] = useState("");
  
  const { qrCode, stats, loading: qrLoading, error: qrError, regenerateQRCode } = useQRCode(merchantId);

  const isCanceledLocked = !entitlements.loading
    && entitlements.subscriptionData.isCanceled
    && !entitlements.subscriptionData.isCanceledTrial;
  const isReadOnlyAccess = !entitlements.loading
    && !!entitlements.subscriptionData.subscription
    && entitlements.trialExpired
    && !entitlements.isSubscribed
    && !isCanceledLocked;
  const isActionBlocked = isReadOnlyAccess || isCanceledLocked;

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
    if (isActionBlocked) return;
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
    if (isActionBlocked) return;
    if (!confirm('Generate a new QR code? The old QR code will be deactivated.')) {
      return;
    }

    await regenerateQRCode();
    
    toast({
      title: "QR Code Regenerated",
      description: "A new QR code has been created.",
    });
  };

  const shareBaseUrl = import.meta.env.VITE_PUBLIC_URL || window.location.origin;

  return (
      <div className="relative max-w-2xl mx-auto space-y-8 pb-4">
        {isCanceledLocked && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-background/70 backdrop-blur-[2px] animate-in fade-in-0 duration-200">
            <div className="max-w-md rounded-lg border bg-card px-6 py-4 text-center shadow-sm">
              <p className="text-sm text-muted-foreground">
                Your subscription has ended. Reactivate to access your QR code.
              </p>
              <Button asChild size="sm" className="mt-3">
                <Link to="/merchant/billing">Reactivate Subscription</Link>
              </Button>
            </div>
          </div>
        )}
        <div
          className={
            isCanceledLocked
              ? 'pointer-events-none blur-sm'
              : isReadOnlyAccess
                ? 'pointer-events-none opacity-60'
                : ''
          }
        >
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
          <div className="relative">
            {isReadOnlyAccess && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/70 backdrop-blur-[2px] animate-in fade-in-0 duration-200">
                <div className="rounded-lg border bg-card px-5 py-3 text-center shadow-sm">
                  <p className="text-sm text-muted-foreground">
                    Subscribe to access your QR code and booking link.
                  </p>
                </div>
              </div>
            )}
            <div className={`flex items-center justify-center bg-secondary rounded-lg p-8 mb-4 ${isActionBlocked ? 'opacity-60 pointer-events-none' : ''}`}>
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
              ) : qrCode?.image_url && !isActionBlocked ? (
                <>
                  <img src={qrCode.image_url} alt="Business QR Code" className="w-64 h-64 mx-auto mb-4" />
                  <div className="flex gap-2 justify-center">
                    <Button onClick={handleDownloadQR} disabled={isActionBlocked}>
                      <Download className="w-4 h-4 mr-2" />Download
                    </Button>
                    <Button variant="outline" onClick={handleRegenerateQR} disabled={isActionBlocked}>
                      <RefreshCw className="w-4 h-4 mr-2" />Regenerate
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <QrCode className="w-48 h-48 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {isActionBlocked ? 'QR code locked' : 'No QR code available'}
                  </p>
                </>
              )}
            </div>
          </div>
          </div>
          {qrCode && !isActionBlocked && (
            <div className="mt-6 p-4 bg-muted rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-2">
                <svg className="h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                <h3 className="font-semibold text-sm">Share Your Booking Link</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Use this short URL to share your booking page directly. Perfect for social media, email signatures, or text messages.
              </p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-background px-3 py-2 rounded border flex-1 overflow-x-auto whitespace-nowrap">
                  {`${shareBaseUrl}/r/${qrCode.short_code}`}
                </code>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    const fullUrl = `${shareBaseUrl}/r/${qrCode.short_code}`;
                    navigator.clipboard.writeText(fullUrl);
                    toast({
                      title: "Link copied!",
                      description: "Full URL copied to clipboard",
                    });
                  }}
                >
                  <svg className="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                  </svg>
                </Button>
              </div>
            </div>
          )}
        </Card>

        </div>
      </div>
  );
};

export default QRCodePage;
