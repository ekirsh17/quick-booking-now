import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import debounce from "lodash/debounce";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  QrCode,
  Download,
  RefreshCw,
  User,
  MessageSquare,
  X,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  businessNameToHandle,
  merchantHandleSchema,
  normalizeHandleInput,
  validateMerchantHandle,
} from "@/lib/merchantHandle";
import { supabase } from "@/integrations/supabase/client";
import { useQRCode } from "@/hooks/useQRCode";
import { useEntitlements } from "@/hooks/useEntitlements";
import { Link } from "react-router-dom";
import { useActiveLocation } from "@/hooks/useActiveLocation";
import { useActivationContext } from "@/contexts/ActivationContext";
import { useSetupSectionFocus } from "@/lib/setupSectionFocus";
import { formatUrlForDisplay } from "@/utils/displayUrl";
import { subtleAccentOutlineHover } from "@/lib/interactiveHover";
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

type HandleAvailability = "idle" | "checking" | "available" | "taken" | "invalid";

interface RowIconActionsProps {
  children: ReactNode;
}

function RowIconActions({ children }: RowIconActionsProps) {
  return <div className="flex shrink-0 items-center gap-1">{children}</div>;
}

interface WaitlistLinkRowProps {
  displayUrl: string;
  copyLabel?: string;
  copied: boolean;
  disabled?: boolean;
  onCopy: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
  isRemoving?: boolean;
  onCustomize?: () => void;
}

function WaitlistLinkRow({
  displayUrl,
  copyLabel = "Copy waitlist link",
  copied,
  disabled,
  onCopy,
  onEdit,
  onRemove,
  isRemoving = false,
  onCustomize,
}: WaitlistLinkRowProps) {
  const renderEditRemoveActions = (size: "compact" | "touch") => {
    if (!onEdit && !onRemove) return null;
    const isTouch = size === "touch";
    const dim = isTouch ? "h-11 w-11" : "h-8 w-8";
    const iconVariant = isTouch ? "outline" : "ghost";

    return (
      <RowIconActions>
        {onEdit ? (
          <Button
            type="button"
            variant={iconVariant}
            size="icon"
            className={
              isTouch
                ? `${dim} shrink-0 ${subtleAccentOutlineHover}`
                : `${dim} shrink-0 text-muted-foreground hover:bg-accent/10 hover:text-warning`
            }
            onClick={onEdit}
            disabled={isRemoving}
            aria-label="Edit custom link"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ) : null}
        {onRemove ? (
          <Button
            type="button"
            variant={iconVariant}
            size="icon"
            className={
              isTouch
                ? `${dim} shrink-0 hover:!border-destructive/40 hover:!bg-destructive/5 hover:!text-destructive`
                : `${dim} shrink-0 text-muted-foreground hover:text-destructive`
            }
            onClick={onRemove}
            disabled={isRemoving}
            aria-label="Remove custom link"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </RowIconActions>
    );
  };

  const renderCompactCopyButton = () => (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-8 shrink-0 px-2 text-xs sm:px-3"
      aria-label={copyLabel}
      onClick={onCopy}
      disabled={disabled}
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  );

  const renderCustomizeAction = () => {
    if (!onCustomize) return null;

    return (
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-8 shrink-0 px-2 text-xs font-medium"
        onClick={onCustomize}
      >
        Customize link
      </Button>
    );
  };

  const renderCompactLinkToolbar = (className?: string) => (
    <div
      className={`flex items-center gap-2 rounded-lg border border-border bg-background p-1.5 ${className ?? ""}`}
    >
      <code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap px-2 py-2 text-xs sm:text-sm">
        {displayUrl}
      </code>
      {renderEditRemoveActions("compact")}
      {renderCustomizeAction()}
      {renderCompactCopyButton()}
    </div>
  );

  const showStackedMobileLayout = Boolean(onEdit || onRemove);

  return (
    <>
      {showStackedMobileLayout ? (
        <div className="space-y-3 sm:hidden">
          <div className="rounded-lg border border-border bg-background px-3 py-3">
            <code className="block break-all font-mono text-xs leading-snug">{displayUrl}</code>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              aria-label={copyLabel}
              onClick={onCopy}
              disabled={disabled}
            >
              {copied ? "Copied" : "Copy link"}
            </Button>
            {renderEditRemoveActions("touch")}
          </div>
        </div>
      ) : (
        renderCompactLinkToolbar()
      )}
      {showStackedMobileLayout ? renderCompactLinkToolbar("hidden sm:flex") : null}
    </>
  );
}

interface WaitlistHandleEditorProps {
  shareHost: string;
  draftHandle: string;
  locationSlug: string | null | undefined;
  availability: HandleAvailability;
  validationError: string;
  isSaving: boolean;
  canSave: boolean;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function WaitlistHandleEditor({
  shareHost,
  draftHandle,
  locationSlug,
  availability,
  validationError,
  isSaving,
  canSave,
  onDraftChange,
  onSave,
  onCancel,
}: WaitlistHandleEditorProps) {
  const showFullLink = Boolean(locationSlug);
  const fullLinkDisplay = showFullLink
    ? `${shareHost}/${draftHandle || "…"}/${locationSlug}`
    : "";
  const showStatus =
    availability === "checking"
    || availability === "taken"
    || (availability === "invalid" && Boolean(validationError));

  return (
    <div className="space-y-3">
      <div className="flex min-w-0 items-center gap-1 rounded-lg border border-border bg-background p-1.5">
        <span className="max-w-[38%] shrink-0 truncate whitespace-nowrap px-1 py-2 font-mono text-[11px] text-muted-foreground sm:max-w-none sm:px-2 sm:text-sm">
          {shareHost}/
        </span>
        <Input
          value={draftHandle}
          onChange={(event) => onDraftChange(event.target.value)}
          maxLength={30}
          disabled={isSaving}
          className="h-8 min-h-0 min-w-0 flex-1 border-0 bg-transparent px-1 py-1.5 font-mono text-xs text-foreground shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:h-9 sm:px-2 sm:text-sm"
          aria-label="Custom link handle"
          autoComplete="off"
          spellCheck={false}
        />
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            onClick={onCancel}
            disabled={isSaving}
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 shrink-0 px-2 text-xs sm:px-3"
            onClick={onSave}
            disabled={!canSave}
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>
      {showFullLink ? (
        <p className="break-all font-mono text-xs leading-snug text-muted-foreground">{fullLinkDisplay}</p>
      ) : null}
      {showStatus ? (
        <div className="text-sm">
          {availability === "checking" && (
            <span className="text-muted-foreground">Checking…</span>
          )}
          {availability === "taken" && (
            <span className="flex items-center gap-1.5 text-destructive">
              <X className="h-4 w-4 shrink-0" aria-hidden />
              Already taken
            </span>
          )}
          {availability === "invalid" && validationError && (
            <span className="text-destructive">{validationError}</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

const QRCodePage = () => {
  useSetupSectionFocus(undefined, { scrollDelayMs: 400 });
  const { toast } = useToast();
  const entitlements = useEntitlements();
  const [businessName, setBusinessName] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [handle, setHandle] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [draftHandle, setDraftHandle] = useState("");
  const [availability, setAvailability] = useState<HandleAvailability>("idle");
  const [validationError, setValidationError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRemovingHandle, setIsRemovingHandle] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isRegenerateDialogOpen, setIsRegenerateDialogOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
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

  const shareBaseUrl = (import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/+$/, "");

  const shareHost = useMemo(() => formatUrlForDisplay(shareBaseUrl), [shareBaseUrl]);

  const customShareUrl = useMemo(() => {
    if (!handle || !activeLocation?.share_slug) return "";
    return `${shareBaseUrl}/${handle}/${activeLocation.share_slug}`;
  }, [activeLocation?.share_slug, handle, shareBaseUrl]);

  const baseShareUrl = useMemo(() => {
    if (!qrCode) return "";
    return `${shareBaseUrl}/r/${qrCode.short_code}`;
  }, [qrCode, shareBaseUrl]);

  const displayCustomShareUrl = useMemo(() => formatUrlForDisplay(customShareUrl), [customShareUrl]);
  const displayBaseShareUrl = useMemo(() => formatUrlForDisplay(baseShareUrl), [baseShareUrl]);

  const hasCustomLink = Boolean(handle && customShareUrl);

  const canSaveHandle =
    !isActionBlocked
    && !isSaving
    && !isRemovingHandle
    && availability === "available"
    && draftHandle.length > 0;

  const checkHandleAvailability = useCallback(
    async (draft: string, currentMerchantId: string, savedHandle: string | null) => {
      const validation = validateMerchantHandle(draft);
      if (!validation.ok) {
        setAvailability("invalid");
        setValidationError(validation.error);
        return;
      }

      setValidationError("");

      if (draft === savedHandle) {
        setAvailability("available");
        return;
      }

      setAvailability("checking");

      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("handle", draft)
        .neq("id", currentMerchantId)
        .maybeSingle();

      if (error) {
        setAvailability("invalid");
        setValidationError("Could not check availability");
        return;
      }

      setAvailability(data ? "taken" : "available");
    },
    [],
  );

  const debouncedCheckRef = useRef(
    debounce((draft: string, currentMerchantId: string, savedHandle: string | null) => {
      void checkHandleAvailability(draft, currentMerchantId, savedHandle);
    }, 300),
  );

  useEffect(() => {
    const debounced = debouncedCheckRef.current;
    return () => debounced.cancel();
  }, []);

  useEffect(() => {
    if (!isEditorOpen || !merchantId) {
      return;
    }
    debouncedCheckRef.current(draftHandle, merchantId, handle);
  }, [draftHandle, handle, isEditorOpen, merchantId]);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setMerchantId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("business_name, handle")
        .eq("id", user.id)
        .single();

      if (profile) {
        setBusinessName(profile.business_name || "");
        setHandle(profile.handle);
      }
    };

    void fetchProfile();
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

  const openHandleEditor = () => {
    if (isActionBlocked) return;
    const initial = handle ?? businessNameToHandle(businessName);
    setDraftHandle(initial);
    setAvailability("idle");
    setValidationError("");
    setIsEditorOpen(true);
  };

  const closeHandleEditor = () => {
    setIsEditorOpen(false);
    setDraftHandle("");
    setAvailability("idle");
    setValidationError("");
  };

  const handleDraftChange = (value: string) => {
    const normalized = normalizeHandleInput(value);
    setDraftHandle(normalized);
  };

  const handleSaveHandle = async () => {
    if (!merchantId || !canSaveHandle) return;

    const parsed = merchantHandleSchema.safeParse(draftHandle);
    if (!parsed.success) {
      const message = parsed.error.errors[0]?.message ?? "Invalid handle";
      setAvailability("invalid");
      setValidationError(message);
      return;
    }

    setIsSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ handle: parsed.data })
      .eq("id", merchantId);

    setIsSaving(false);

    if (error) {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setHandle(parsed.data);
    closeHandleEditor();
    void markQrEngaged();
    toast({
      title: "Link updated",
    });
  };

  const handleRemoveCustomLink = async () => {
    if (!merchantId || !handle || isActionBlocked) return;

    setIsRemovingHandle(true);
    const { error } = await supabase
      .from("profiles")
      .update({ handle: null })
      .eq("id", merchantId);
    setIsRemovingHandle(false);

    if (error) {
      toast({
        title: "Unable to remove custom link",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setHandle(null);
    setCopiedLink(false);
    closeHandleEditor();
    setIsRemoveDialogOpen(false);
    toast({
      title: "Custom link removed",
    });
  };

  const handleCopyActiveLink = () => {
    const urlToCopy = hasCustomLink ? customShareUrl : baseShareUrl;
    if (isActionBlocked || !urlToCopy) return;
    void markQrEngaged();
    setCopiedLink(true);
    try {
      void navigator.clipboard.writeText(urlToCopy);
    } catch {
      // Ignore clipboard errors; keep feedback consistent with existing behavior.
    }
  };

  useEffect(() => {
    if (!copiedLink) return;
    const timeoutId = window.setTimeout(() => setCopiedLink(false), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copiedLink]);

  const renderWaitlistLinkSection = () => {
    if (!qrCode || isActionBlocked) {
      return (
        <p className="text-sm text-muted-foreground">
          {isActionBlocked ? "Link locked" : "No link available"}
        </p>
      );
    }

    if (isEditorOpen) {
      return (
        <WaitlistHandleEditor
          shareHost={shareHost}
          draftHandle={draftHandle}
          locationSlug={activeLocation?.share_slug}
          availability={availability}
          validationError={validationError}
          isSaving={isSaving}
          canSave={canSaveHandle}
          onDraftChange={handleDraftChange}
          onSave={() => void handleSaveHandle()}
          onCancel={closeHandleEditor}
        />
      );
    }

    if (hasCustomLink) {
      return (
        <div className="space-y-2">
          <WaitlistLinkRow
            displayUrl={displayCustomShareUrl}
            copyLabel="Copy custom waitlist link"
            copied={copiedLink}
            disabled={!customShareUrl}
            onCopy={handleCopyActiveLink}
            onEdit={openHandleEditor}
            onRemove={() => setIsRemoveDialogOpen(true)}
            isRemoving={isRemovingHandle}
          />
          <p className="text-xs text-muted-foreground">
            Location name can be edited in{" "}
            <Link
              to="/merchant/settings/staff-locations"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Staff &amp; Locations
            </Link>
          </p>
        </div>
      );
    }

    if (handle && !activeLocation?.share_slug) {
      return (
        <div className="space-y-3">
          <WaitlistLinkRow
            displayUrl={displayBaseShareUrl}
            copyLabel="Copy waitlist link"
            copied={copiedLink}
            disabled={!baseShareUrl}
            onCopy={handleCopyActiveLink}
          />
          <p className="text-xs text-muted-foreground">
            Add a location waitlist link in{" "}
            <Link
              to="/merchant/settings/staff-locations"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Staff &amp; Locations
            </Link>{" "}
            to finish your custom URL.
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full min-h-[44px] sm:w-auto"
            onClick={openHandleEditor}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit custom handle
          </Button>
        </div>
      );
    }

    return (
      <WaitlistLinkRow
        displayUrl={displayBaseShareUrl}
        copyLabel="Copy waitlist link"
        copied={copiedLink}
        disabled={!baseShareUrl}
        onCopy={handleCopyActiveLink}
        onCustomize={openHandleEditor}
      />
    );
  };

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
                  Customers can join your waitlist from this QR code or link for{" "}
                  <span className="font-semibold">
                    {activeLocation?.name || "selected location"}
                  </span>
                </>
              ) : (
                "Customers can join your waitlist from this QR code or link"
              )}
            </p>
          </div>

          <Card className="p-4 sm:p-6 lg:p-7">
            <div className="space-y-6">
              <div className="space-y-6">
                {isReadOnlyAccess && (
                  <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                    Subscribe to access your QR code and link
                  </div>
                )}

                <div
                  className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,420px)_minmax(0,1fr)] lg:gap-8"
                  data-setup-section="share-qr"
                  data-setup-share-qr-scope="full"
                  data-tour-target="qr-code-display"
                >
                <section
                  className="h-full"
                  data-setup-section="share-qr"
                  data-setup-share-qr-scope="qr"
                >
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
                            <Button onClick={handleDownloadQR} disabled={isActionBlocked} className="min-h-[44px] w-full">
                              <Download className="mr-2 h-4 w-4" />
                              Download QR
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setIsRegenerateDialogOpen(true)}
                              disabled={isActionBlocked}
                              className="min-h-[44px] w-full"
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

                      <div className="space-y-4">
                        {renderWaitlistLinkSection()}
                      </div>

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

      <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-lg rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove custom link?</AlertDialogTitle>
            <AlertDialogDescription>
              Your waitlist will use the short link ({displayBaseShareUrl || "openalert.org/r/…"}) again.
              QR codes you have already printed will keep working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingHandle}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleRemoveCustomLink();
              }}
              disabled={isRemovingHandle}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemovingHandle ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default QRCodePage;
