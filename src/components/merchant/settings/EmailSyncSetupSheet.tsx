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
import {
  AUTO_OPENINGS_SETUP_TITLE,
  EMAIL_CLIENT_OPTIONS,
  getAutoOpeningsSetupSubtitle,
  getDefaultEmailSyncTab,
  getEmailSyncGuide,
  getForwardingGuide,
  type EmailClientKind,
  type EmailSyncPathKind,
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

function NumberedSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
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
    <div className="space-y-2 border-t border-border pt-4">
      <Label className="text-sm">Your OpenAlert address</Label>
      <p className="text-xs text-muted-foreground">
        Paste this in your booking platform or email forward settings
      </p>
      <div className="flex gap-2">
        <Input value={addressDisplay} readOnly className="text-sm" />
        <Button
          type="button"
          variant="outline"
          className="shrink-0 min-h-[44px]"
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
          size="sm"
          className="min-h-[44px] w-full sm:w-auto"
          disabled={isOpeningVerification}
          onClick={onVerify}
        >
          {isOpeningVerification ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Opening verification…
            </>
          ) : (
            'Complete forwarding verification'
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

  return (
    <div className="space-y-4">
      {needsPlatformSelection ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Select your booking platform above first
        </p>
      ) : null}

      <Tabs value={activeTab} onValueChange={(value) => onActiveTabChange(value as EmailSyncPathKind)}>
        <TabsList className="grid h-10 w-full grid-cols-2 rounded-lg bg-muted/50 p-1">
          <TabsTrigger value="platform_recipient" className="text-xs sm:text-sm">
            Add in {platformGuide.platformLabel}
          </TabsTrigger>
          <TabsTrigger value="email_forwarding" className="text-xs sm:text-sm">
            Forward email
          </TabsTrigger>
        </TabsList>

        <TabsContent value="platform_recipient" className="mt-4 space-y-3">
          <NumberedSteps steps={platformGuide.recipientSteps} />
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

        <TabsContent value="email_forwarding" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Use this if {platformGuide.platformLabel} won&apos;t let you add another notification
            email
          </p>
          <div className="space-y-2">
            <Label className="text-sm">Email provider</Label>
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
          <NumberedSteps steps={forwardingGuide.steps} />
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
