import { useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  EMAIL_SYNC_VERIFY_BUTTON_LABEL,
  getAutoOpeningsSetupSubtitle,
  getDefaultEmailSyncTab,
  getEmailSyncGuide,
  getForwardingGuide,
  getForwardingPathIntro,
  getPlatformPathIntro,
  getRecommendedEmailSyncPath,
  type EmailClientKind,
  type EmailSyncPathKind,
  type EmailSyncStep,
} from '@/lib/emailSyncSetupGuides';

interface EmailSyncSetupSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: (path: EmailSyncPathKind) => void;
  platformProvider: string;
  inboundEmailAddress: string;
  inboundEmailLoading: boolean;
  copied: boolean;
  onCopy: () => void;
  showVerifyButton: boolean;
  isOpeningVerification: boolean;
  onVerify: () => void;
}

function GuidedSteps({ steps, compact }: { steps: EmailSyncStep[]; compact?: boolean }) {
  return (
    <ol className={cn('space-y-0', compact ? 'pt-0' : 'pt-0.5')} aria-label="Setup steps">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;

        return (
          <li key={index} className={cn('flex', compact ? 'gap-3' : 'gap-3.5')}>
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary',
                  compact ? 'h-5 w-5 text-[10px]' : 'h-6 w-6 text-xs',
                )}
                aria-hidden
              >
                {index + 1}
              </span>
              {!isLast ? (
                <span
                  className={cn('w-px flex-1 bg-primary/20', compact ? 'mt-1' : 'mt-1')}
                  aria-hidden
                />
              ) : null}
            </div>
            <p
              className={cn(
                'text-muted-foreground',
                compact ? 'pb-2 text-xs leading-snug' : 'pb-3 text-sm leading-snug',
                isLast && 'pb-0',
              )}
            >
              {step}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function ProviderHelpLink({ label, href, compact }: { label: string; href: string; compact?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1 text-primary hover:underline',
        compact ? 'pt-0.5 text-[11px]' : 'pt-1 text-xs',
      )}
    >
      {label} help
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}

function PathTabLabel({
  title,
  showRecommended,
}: {
  title: string;
  showRecommended: boolean;
}) {
  if (showRecommended) {
    return (
      <span className="flex min-h-[2.25rem] flex-col items-center justify-center gap-0.5 py-0.5">
        <span>{title}</span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
          Recommended
        </span>
      </span>
    );
  }

  return (
    <span className="flex min-h-[2.25rem] items-center justify-center py-0.5">
      <span>{title}</span>
    </span>
  );
}

function SetupEmailInline({
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
    <div className="space-y-2">
      <div className="flex min-w-0 items-center gap-1.5 rounded-md border border-border bg-muted/30 p-1">
        <span className="sr-only">Email to copy</span>
        <code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap px-1 py-0.5 font-mono text-[11px] sm:text-xs">
          {addressDisplay}
        </code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 shrink-0 px-2 text-[11px] sm:text-xs"
          disabled={!inboundEmailAddress}
          aria-label="Copy email"
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
          className="h-8 w-full text-xs sm:w-auto"
          disabled={isOpeningVerification}
          onClick={onVerify}
        >
          {isOpeningVerification ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
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
  compact,
}: Omit<EmailSyncSetupSheetProps, 'open' | 'onOpenChange' | 'onComplete'> & {
  activeTab: EmailSyncPathKind;
  onActiveTabChange: (tab: EmailSyncPathKind) => void;
  emailClient: EmailClientKind;
  onEmailClientChange: (client: EmailClientKind) => void;
  compact?: boolean;
}) {
  const platformGuide = getEmailSyncGuide(platformProvider || null);
  const forwardingGuide = getForwardingGuide(emailClient);
  const needsPlatformSelection = !platformProvider;
  const recommendedPath = getRecommendedEmailSyncPath(platformProvider || null);
  const tabContentClass = cn(compact ? 'mt-2 space-y-2.5' : 'mt-3 space-y-3');

  const emailInlineProps = {
    inboundEmailAddress,
    inboundEmailLoading,
    copied,
    onCopy,
    isOpeningVerification,
    onVerify,
  };

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
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
              title="Forward Emails"
              showRecommended={recommendedPath === 'email_forwarding'}
            />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="platform_recipient" className={tabContentClass}>
          <div className="space-y-2">
            <p
              className={cn(
                'text-muted-foreground',
                compact ? 'text-xs leading-snug' : 'text-sm leading-snug',
              )}
            >
              {getPlatformPathIntro(platformGuide.platformLabel)}
            </p>
            <GuidedSteps steps={platformGuide.recipientSteps} compact={compact} />
          </div>
          <SetupEmailInline {...emailInlineProps} showVerifyButton={false} />
          {platformGuide.officialHelpUrl ? (
            <ProviderHelpLink
              label={platformGuide.platformLabel}
              href={platformGuide.officialHelpUrl}
              compact={compact}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="email_forwarding" className={tabContentClass}>
          <Select
            value={emailClient}
            onValueChange={(value) => onEmailClientChange(value as EmailClientKind)}
            modal={false}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Your email provider" />
            </SelectTrigger>
            <SelectContent className="z-[100]">
              {EMAIL_CLIENT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-2">
            <p
              className={cn(
                'text-muted-foreground',
                compact ? 'text-xs leading-snug' : 'text-sm leading-snug',
              )}
            >
              {getForwardingPathIntro(platformGuide.platformLabel)}
            </p>
            <GuidedSteps steps={forwardingGuide.steps} compact={compact} />
          </div>
          <SetupEmailInline
            {...emailInlineProps}
            showVerifyButton={showVerifyButton && activeTab === 'email_forwarding'}
          />
          {forwardingGuide.officialHelpUrl ? (
            <ProviderHelpLink
              label={forwardingGuide.label}
              href={forwardingGuide.officialHelpUrl}
              compact={compact}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SetupSheetFooter({
  onOpenChange,
  onComplete,
  activeTab,
  isMobile,
}: {
  onOpenChange: (open: boolean) => void;
  onComplete?: (path: EmailSyncPathKind) => void;
  activeTab: EmailSyncPathKind;
  isMobile: boolean;
}) {
  return (
    <Button
      type="button"
      className={cn('min-h-[44px] font-medium', isMobile ? 'w-full' : 'sm:min-w-[120px]')}
      onClick={() => {
        onComplete?.(activeTab);
        onOpenChange(false);
      }}
    >
      Done
    </Button>
  );
}

export function EmailSyncSetupSheet({
  open,
  onOpenChange,
  onComplete,
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
    compact: isMobile,
  };

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="z-[80] flex h-auto max-h-[90vh] flex-col overflow-hidden rounded-t-2xl p-0"
        >
          <SheetHeader className="flex-shrink-0 border-b border-border bg-background px-4 pb-2 pt-4">
            <SheetTitle className="text-left">{AUTO_OPENINGS_SETUP_TITLE}</SheetTitle>
            <p className="mt-0.5 text-left text-[11px] text-muted-foreground">{subtitle}</p>
          </SheetHeader>
          <div className="overflow-hidden px-4 pt-1 pb-3">
            <AutoOpeningsSetupBody {...bodyProps} />
          </div>
          <div className="flex-shrink-0 border-t border-border bg-background pb-safe">
            <div className="p-3">
              <SetupSheetFooter
                onOpenChange={onOpenChange}
                onComplete={onComplete}
                activeTab={activeTab}
                isMobile
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] min-h-0 max-w-[95vw] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[600px]">
        <DialogHeader className="flex-shrink-0 border-b border-border px-6 pb-4 pt-6">
          <DialogTitle className="text-left text-lg">{AUTO_OPENINGS_SETUP_TITLE}</DialogTitle>
          <p className="mt-1 text-left text-xs text-muted-foreground">{subtitle}</p>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-6 py-4">
          <AutoOpeningsSetupBody {...bodyProps} />
        </div>
        <DialogFooter className="flex-shrink-0 border-t border-border bg-background px-6 py-3">
          <SetupSheetFooter
            onOpenChange={onOpenChange}
            onComplete={onComplete}
            activeTab={activeTab}
            isMobile={false}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
