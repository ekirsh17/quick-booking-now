import { useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  AUTO_OPENINGS_SETUP_TITLE,
  EMAIL_CLIENT_OPTIONS,
  EMAIL_SYNC_EMPTY_PLATFORM_MESSAGE,
  EMAIL_SYNC_PROVIDER_LABEL,
  EMAIL_SYNC_VERIFY_BUTTON_LABEL,
  getAutoOpeningsSetupSubtitle,
  getDefaultEmailSyncTab,
  getEmailSyncGuide,
  getForwardingGuide,
  getForwardingPathIntro,
  getPlatformPathIntro,
  getRecommendedEmailSyncPath,
  OPENALERT_ADDRESS_CHIP,
  type EmailClientKind,
  type EmailSyncPathKind,
  type EmailSyncStep,
} from '@/lib/emailSyncSetupGuides';

interface EmailSyncSetupSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platformProvider: string;
  inboundEmailAddress: string;
  inboundEmailLoading: boolean;
  copied: boolean;
  onCopy: () => void;
  showVerifyButton: boolean;
  isOpeningVerification: boolean;
  onVerify: () => void;
}

function StepText({ step }: { step: EmailSyncStep }) {
  if (typeof step === 'string') {
    return <>{step}</>;
  }

  return (
    <>
      {step.before}
      <span className="rounded bg-primary/10 px-1 py-0.5 font-medium text-foreground">
        {OPENALERT_ADDRESS_CHIP}
      </span>
      {step.after}
    </>
  );
}

function GuidedSteps({ steps }: { steps: EmailSyncStep[] }) {
  return (
    <ol className="space-y-0" aria-label="Setup steps">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;

        return (
          <li key={index} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                aria-hidden
              >
                {index + 1}
              </span>
              {!isLast ? <span className="mt-1 w-px flex-1 bg-primary/20" aria-hidden /> : null}
            </div>
            <p className={cn('pb-4 text-sm text-muted-foreground', isLast && 'pb-0')}>
              <StepText step={step} />
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function PathTabLabel({
  title,
  showRecommended,
}: {
  title: string;
  showRecommended: boolean;
}) {
  return (
    <span className="flex flex-col items-center gap-0.5 py-0.5">
      <span>{title}</span>
      {showRecommended ? (
        <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
          Recommended
        </span>
      ) : null}
    </span>
  );
}

function OpenAlertAddressBlock({
  inboundEmailAddress,
  inboundEmailLoading,
  copied,
  onCopy,
  showVerifyButton,
  isOpeningVerification,
  onVerify,
}: Pick<
  EmailSyncSetupSheetProps,
  | 'inboundEmailAddress'
  | 'inboundEmailLoading'
  | 'copied'
  | 'onCopy'
  | 'showVerifyButton'
  | 'isOpeningVerification'
  | 'onVerify'
>) {
  const addressDisplay =
    inboundEmailLoading && !inboundEmailAddress
      ? 'Generating...'
      : inboundEmailAddress || 'Generating...';

  return (
    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div>
        <p className="text-sm font-semibold">Your OpenAlert address</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Paste this in your booking platform or email forward settings
        </p>
      </div>
      <div className="flex gap-2">
        <Input value={addressDisplay} readOnly className="bg-background text-sm" />
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] shrink-0 bg-background"
          disabled={!inboundEmailAddress}
          onClick={onCopy}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      {showVerifyButton ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] w-full bg-background sm:w-auto"
          disabled={isOpeningVerification}
          onClick={onVerify}
        >
          {isOpeningVerification ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Opening verification…
            </>
          ) : (
            EMAIL_SYNC_VERIFY_BUTTON_LABEL
          )}
        </Button>
      ) : null}
    </div>
  );
}

function AutoOpeningsSetupBody({
  platformProvider,
  inboundEmailAddress,
  inboundEmailLoading,
  copied,
  onCopy,
  showVerifyButton,
  isOpeningVerification,
  onVerify,
  activeTab,
  onActiveTabChange,
  emailClient,
  onEmailClientChange,
}: Omit<EmailSyncSetupSheetProps, 'open' | 'onOpenChange'> & {
  activeTab: EmailSyncPathKind;
  onActiveTabChange: (tab: EmailSyncPathKind) => void;
  emailClient: EmailClientKind;
  onEmailClientChange: (client: EmailClientKind) => void;
}) {
  const platformGuide = getEmailSyncGuide(platformProvider || null);
  const forwardingGuide = getForwardingGuide(emailClient);
  const needsPlatformSelection = !platformProvider;
  const recommendedPath = getRecommendedEmailSyncPath(platformProvider || null);

  return (
    <div className="space-y-4">
      {needsPlatformSelection ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {EMAIL_SYNC_EMPTY_PLATFORM_MESSAGE}
        </p>
      ) : null}

      <Tabs value={activeTab} onValueChange={(value) => onActiveTabChange(value as EmailSyncPathKind)}>
        <TabsList className="grid h-auto min-h-[52px] w-full grid-cols-2 rounded-lg bg-muted/50 p-1">
          <TabsTrigger value="platform_recipient" className="h-auto py-2 text-xs sm:text-sm">
            <PathTabLabel
              title={`Add in ${platformGuide.platformLabel}`}
              showRecommended={recommendedPath === 'platform_recipient'}
            />
          </TabsTrigger>
          <TabsTrigger value="email_forwarding" className="h-auto py-2 text-xs sm:text-sm">
            <PathTabLabel
              title="Forward email"
              showRecommended={recommendedPath === 'email_forwarding'}
            />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="platform_recipient" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            {getPlatformPathIntro(platformGuide.platformLabel)}
          </p>
          <GuidedSteps steps={platformGuide.recipientSteps} />
          {platformGuide.officialHelpUrl ? (
            <a
              href={platformGuide.officialHelpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {platformGuide.platformLabel} help
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : null}
        </TabsContent>

        <TabsContent value="email_forwarding" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            {getForwardingPathIntro(platformGuide.platformLabel)}
          </p>
          <div className="space-y-2">
            <Label className="text-sm">{EMAIL_SYNC_PROVIDER_LABEL}</Label>
            <Select value={emailClient} onValueChange={(value) => onEmailClientChange(value as EmailClientKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_CLIENT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <GuidedSteps steps={forwardingGuide.steps} />
        </TabsContent>
      </Tabs>

      <OpenAlertAddressBlock
        inboundEmailAddress={inboundEmailAddress}
        inboundEmailLoading={inboundEmailLoading}
        copied={copied}
        onCopy={onCopy}
        showVerifyButton={showVerifyButton && activeTab === 'email_forwarding'}
        isOpeningVerification={isOpeningVerification}
        onVerify={onVerify}
      />
    </div>
  );
}

export function EmailSyncSetupSheet({
  open,
  onOpenChange,
  platformProvider,
  inboundEmailAddress,
  inboundEmailLoading,
  copied,
  onCopy,
  showVerifyButton,
  isOpeningVerification,
  onVerify,
}: EmailSyncSetupSheetProps) {
  const isMobile = useIsMobile();
  const platformGuide = getEmailSyncGuide(platformProvider || null);
  const subtitle = getAutoOpeningsSetupSubtitle(platformGuide.platformLabel);

  const [activeTab, setActiveTab] = useState<EmailSyncPathKind>(() =>
    getDefaultEmailSyncTab(platformProvider || null)
  );
  const [emailClient, setEmailClient] = useState<EmailClientKind>('gmail');

  useEffect(() => {
    if (!open) return;
    setActiveTab(getDefaultEmailSyncTab(platformProvider || null));
    setEmailClient('gmail');
  }, [open, platformProvider]);

  const bodyProps = {
    platformProvider,
    inboundEmailAddress,
    inboundEmailLoading,
    copied,
    onCopy,
    showVerifyButton,
    isOpeningVerification,
    onVerify,
    activeTab,
    onActiveTabChange: setActiveTab,
    emailClient,
    onEmailClientChange: setEmailClient,
  };

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="z-[80] flex h-[85vh] flex-col overflow-hidden rounded-t-2xl p-0"
        >
          <SheetHeader className="flex-shrink-0 border-b border-border bg-background px-4 pb-3 pt-5">
            <SheetTitle className="text-left">{AUTO_OPENINGS_SETUP_TITLE}</SheetTitle>
            <p className="mt-1.5 text-left text-xs text-muted-foreground">{subtitle}</p>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <AutoOpeningsSetupBody {...bodyProps} />
          </div>
          <div className="flex-shrink-0 border-t border-border bg-background pb-safe">
            <div className="p-3">
              <Button
                type="button"
                className="min-h-[44px] w-full font-medium"
                onClick={() => onOpenChange(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] min-h-0 max-w-[95vw] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[600px]">
        <DialogHeader className="flex-shrink-0 border-b border-border px-6 pb-5 pt-8">
          <DialogTitle className="text-left text-lg">{AUTO_OPENINGS_SETUP_TITLE}</DialogTitle>
          <p className="mt-1.5 text-left text-xs text-muted-foreground">{subtitle}</p>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <AutoOpeningsSetupBody {...bodyProps} />
        </div>
        <DialogFooter className="flex-shrink-0 border-t border-border bg-background px-6 py-4">
          <Button
            type="button"
            className="min-h-[44px] w-full font-medium sm:w-auto sm:min-w-[120px]"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
