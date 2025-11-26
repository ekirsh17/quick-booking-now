import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock, AlertTriangle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useEntitlements } from '@/hooks/useEntitlements';

interface EntitlementGateProps {
  /** Feature to check: 'openings', 'staff', or 'sms' */
  feature: 'openings' | 'staff' | 'sms';
  /** Content to render when allowed */
  children: ReactNode;
  /** Optional: Custom fallback when blocked */
  fallback?: ReactNode;
  /** Whether to show just a banner instead of blocking */
  mode?: 'block' | 'banner';
  /** Custom message to show when blocked */
  message?: string;
}

/**
 * Gate component that checks entitlements before rendering children.
 * Use this to wrap features that require subscription access.
 */
export function EntitlementGate({
  feature,
  children,
  fallback,
  mode = 'block',
  message,
}: EntitlementGateProps) {
  const entitlements = useEntitlements();
  
  if (entitlements.loading) {
    return <>{children}</>;
  }
  
  // Determine if feature is allowed
  let isAllowed = false;
  switch (feature) {
    case 'openings':
      isAllowed = entitlements.canCreateOpenings;
      break;
    case 'staff':
      isAllowed = entitlements.canAddStaff;
      break;
    case 'sms':
      isAllowed = entitlements.canSendSMS;
      break;
  }
  
  if (isAllowed) {
    return <>{children}</>;
  }
  
  // Feature is blocked
  const blockMessage = message || entitlements.blockReason || 'This feature requires an active subscription.';
  
  if (mode === 'banner') {
    return (
      <>
        <SubscriptionBanner message={blockMessage} />
        {children}
      </>
    );
  }
  
  // Full block mode
  if (fallback) {
    return <>{fallback}</>;
  }
  
  return <BlockedFeature message={blockMessage} />;
}

interface BlockedFeatureProps {
  message: string;
}

function BlockedFeature({ message }: BlockedFeatureProps) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 p-8 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
        <Lock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
      </div>
      <h3 className="mb-2 font-semibold">Feature Locked</h3>
      <p className="mb-4 max-w-md text-sm text-muted-foreground">{message}</p>
      <Button asChild>
        <Link to="/merchant/billing">
          <Zap className="mr-2 h-4 w-4" />
          Manage Subscription
        </Link>
      </Button>
    </div>
  );
}

interface SubscriptionBannerProps {
  message: string;
  className?: string;
}

export function SubscriptionBanner({ message, className }: SubscriptionBannerProps) {
  return (
    <Alert variant="destructive" className={cn('mb-4', className)}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Subscription Required</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>{message}</span>
        <Button variant="outline" size="sm" asChild className="ml-4 shrink-0">
          <Link to="/merchant/billing">Manage Billing</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Simple hook-based check for use in callbacks and effects.
 * Returns whether the feature is allowed.
 */
export function useCanAccess(feature: 'openings' | 'staff' | 'sms'): boolean {
  const entitlements = useEntitlements();
  
  switch (feature) {
    case 'openings':
      return entitlements.canCreateOpenings;
    case 'staff':
      return entitlements.canAddStaff;
    case 'sms':
      return entitlements.canSendSMS;
    default:
      return false;
  }
}

/**
 * Trial progress indicator component
 */
export function TrialProgress() {
  const entitlements = useEntitlements();
  
  if (!entitlements.isTrialing || entitlements.loading) {
    return null;
  }
  
  const daysLeft = entitlements.trialDaysRemaining ?? 0;
  const openingsFilled = entitlements.trialOpeningsFilled ?? 0;
  const openingsMax = entitlements.trialOpeningsMax;
  
  return (
    <div className="rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-900/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium text-emerald-800 dark:text-emerald-200">
            Value Guarantee Trial
          </span>
        </div>
        <Link 
          to="/merchant/billing"
          className="text-emerald-700 underline hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
        >
          View details
        </Link>
      </div>
      <div className="mt-1 text-emerald-700 dark:text-emerald-300">
        {daysLeft} days left • {openingsFilled}/{openingsMax} openings filled
      </div>
    </div>
  );
}

export default EntitlementGate;

