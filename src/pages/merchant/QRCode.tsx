import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Download, RefreshCw, User, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQRCode } from "@/hooks/useQRCode";
import { useEntitlements } from "@/hooks/useEntitlements";
import { Link } from "react-router-dom";
import { useActiveLocation } from "@/hooks/useActiveLocation";
import { useActivationContext } from "@/contexts/ActivationContext";
import { useSetupSectionFocus } from "@/lib/setupSectionFocus";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const QRCodePage = () => {
  useSetupSectionFocus(undefined, { scrollDelayMs: 400 });
  const { toast } = useToast();
  const entitlements = useEntitlements();
  const [businessName, setBusinessName] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [copied, setCopied] = useState(false);
  const [isRegenerateDialogOpen, setIsRegenerateDialogOpen] = useState(false);
  const { locationId, locations } = useActiveLocation();
  const activeLocation = useMemo(
    () => locations.find((location) => location.id === locationId) || null,
    [locationId, locations]
  );
  const showLocationScopeCues = locations.length > 1;

  const { qrCode, loading: qrLoading, error: qrError, regenerateQRCode } = useQRCode(merchantId, locationId);
  const { markQrEngaged } = useActivationContext();

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

  useEffect(() => {
    if (!qrLoading && qrCode && !isActionBlocked) {
      void markQrEngaged();
    }
  }, [isActionBlocked, markQrEngaged, qrCode, qrLoading]);

  const handleDownloadQR = () => {
    if (isActionBlocked) return;
    if (!qrCode?.image_url) return;

    void markQrEngaged();
    const link = document.createElement('a');
    link.download = `${businessName || 'business'}-qr-code.png`;
    link.href = qrCode.image_url;
    link.target = '_blank';
    link.click();

    toast({
      title: "QR Code Downloaded",
      description: "Your QR code has been saved",
    });
  };

  const handleRegenerateQR = async () => {
    if (isActionBlocked) return;

    await regenerateQRCode();
    setIsRegenerateDialogOpen(false);

    toast({
      title: "QR Code Regenerated",
      description: "A new QR code has been created",
    });
  };

  const handleCopyLink = () => {
    if (isActionBlocked || !qrCode) return;
    void markQrEngaged();
    const fullUrl = `${shareBaseUrl}/r/${qrCode.short_code}`;
    setCopied(true);
    try {
      void navigator.clipboard.writeText(fullUrl);
    } catch {
      // Ignore clipboard errors; keep feedback consistent with existing behavior.
    }
    toast({
      title: "Copied",
    });
  };

  useEffect(() => {
    if (!copied) return;
    const timeoutId = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  const shareBaseUrl = (import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/+$/, '');

  return (
    <div className="relative w-full pb-4">
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
        <div className="w-full space-y-8">
          <div>
            <h1 className="mb-1 text-3xl font-bold">QR Code</h1>
            <p className="text-lg text-muted-foreground/80">
              {showLocationScopeCues ? (
                <>
                  Customers can join your waitlist for{" "}
                  <span className="font-semibold">
                    {activeLocation?.name || "selected location"}
                  </span>{" "}
                  from this QR code or link
                </>
              ) : (
                "Customers can join your waitlist from this QR code or link"
              )}
            </p>
          </div>

          <Card className="p-4 sm:p-6 lg:p-7">
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Share this anywhere customers already interact with you</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Place it at checkout, your front desk, Instagram, or your website.
                </p>
              </div>

              <div className="space-y-6" data-setup-section="share-qr">
                {isReadOnlyAccess && (
                  <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                    Subscribe to access your QR code and link
                  </div>
                )}

                <div
                  className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,420px)_minmax(0,1fr)] lg:gap-8"
                  data-tour-target="qr-code-display"
                >
                <section className="h-full">
                  <div
                    className={`h-full rounded-xl border bg-muted/30 p-4 sm:p-5 ${isActionBlocked ? "pointer-events-none opacity-60" : ""}`}
                  >
                    <div className="flex h-full flex-col">
                      <div className="flex-1">
                        {qrLoading ? (
                          <div className="text-center">
                            <div className="mx-auto mb-4 w-fit rounded-lg bg-background p-3 sm:p-4">
                              <QrCode className="h-[220px] w-[220px] animate-pulse text-muted-foreground sm:h-[260px] sm:w-[260px] lg:h-[300px] lg:w-[300px]" />
                            </div>
                            <p className="text-sm text-muted-foreground">Generating QR code...</p>
                          </div>
                        ) : qrError ? (
                          <div className="text-center">
                            <div className="mx-auto mb-4 w-fit rounded-lg bg-background p-3 sm:p-4">
                              <QrCode className="h-[220px] w-[220px] text-destructive sm:h-[260px] sm:w-[260px] lg:h-[300px] lg:w-[300px]" />
                            </div>
                            <p className="text-sm text-destructive">{qrError}</p>
                          </div>
                        ) : qrCode?.image_url && !isActionBlocked ? (
                          <div className="mx-auto w-fit rounded-lg bg-background p-3 sm:p-4">
                            <img
                              src={qrCode.image_url}
                              alt="Customer waitlist QR code"
                              className="mx-auto h-[220px] w-[220px] max-w-full sm:h-[260px] sm:w-[260px] lg:h-[300px] lg:w-[300px]"
                            />
                          </div>
                        ) : (
                          <div className="text-center">
                            <div className="mx-auto mb-4 w-fit rounded-lg bg-background p-3 sm:p-4">
                              <QrCode className="h-[220px] w-[220px] text-muted-foreground sm:h-[260px] sm:w-[260px] lg:h-[300px] lg:w-[300px]" />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {isActionBlocked ? "QR code locked" : "No QR code available"}
                            </p>
                          </div>
                        )}
                      </div>

                      {qrCode?.image_url && !isActionBlocked && (
                        <div className="mt-4 border-t border-border/60 pt-4">
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <Button onClick={handleDownloadQR} disabled={isActionBlocked} className="min-h-10 w-full">
                              <Download className="mr-2 h-4 w-4" />
                              Download QR
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setIsRegenerateDialogOpen(true)}
                              disabled={isActionBlocked}
                              className="min-h-10 w-full"
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Regenerate code
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <section>
                  <div className="h-full rounded-xl border bg-muted/30 p-4 sm:p-5">
                    <div className="space-y-6">
                      <div>
                    <h3 className="text-base font-semibold">Waitlist link</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Send customers directly to your waitlist page
                    </p>
                  </div>

                  {qrCode && !isActionBlocked ? (
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-1.5">
                      <code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap px-2 py-2 text-xs sm:text-sm">
                        {`${shareBaseUrl}/r/${qrCode.short_code}`}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-9 shrink-0 px-3"
                        aria-label="Copy waitlist link"
                        onClick={handleCopyLink}
                      >
                        {copied ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {isActionBlocked ? "Link locked" : "No link available"}
                    </p>
                  )}

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">How it works</h4>
                    <div className="space-y-2">
                      <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-3">
                        <QrCode className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-5">Scan</p>
                          <p className="text-sm text-muted-foreground leading-5">Customer scans the QR code</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-3">
                        <User className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-5">Join</p>
                          <p className="text-sm text-muted-foreground leading-5">They add their name and phone number</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-3">
                        <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-5">Get notified</p>
                          <p className="text-sm text-muted-foreground leading-5">They receive a text when an opening is available</p>
                        </div>
                      </div>
                    </div>
                  </div>
                    </div>
                  </div>
                </section>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <AlertDialog open={isRegenerateDialogOpen} onOpenChange={setIsRegenerateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate QR code?</AlertDialogTitle>
            <AlertDialogDescription>
              Printed or saved versions of your current QR code may stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerateQR}>Regenerate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default QRCodePage;
