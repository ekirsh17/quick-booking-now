import { format } from 'date-fns';
import { 
  CheckCircle2, 
  AlertTriangle, 
  PauseCircle, 
  XCircle,
  Calendar,
  RefreshCcw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SubscriptionStatusProps {
  status: string;
  planName: string;
  monthlyPrice: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  pauseResumesAt: string | null;
}

export function SubscriptionStatus({
  status,
  planName,
  monthlyPrice,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  pauseResumesAt,
}: SubscriptionStatusProps) {
  const statusConfig = {
    trialing: {
      icon: CheckCircle2,
      label: 'Trial',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    },
    active: {
      icon: CheckCircle2,
      label: 'Active',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    },
    past_due: {
      icon: AlertTriangle,
      label: 'Past Due',
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    },
    paused: {
      icon: PauseCircle,
      label: 'Paused',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    canceled: {
      icon: XCircle,
      label: 'Canceled',
      color: 'text-red-600',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
    },
    incomplete: {
      icon: AlertTriangle,
      label: 'Setup Required',
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.incomplete;
  const StatusIcon = config.icon;

  return (
    <div className="rounded-xl border bg-card p-6">
      {/* Plan Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-2xl font-bold">{planName}</h3>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-3xl font-bold">${monthlyPrice}</span>
            <span className="text-muted-foreground">/month</span>
          </div>
        </div>
        
        {/* Status Badge */}
        <Badge 
          variant="secondary"
          className={cn(config.bgColor, config.color, 'gap-1.5')}
        >
          <StatusIcon className="h-3 w-3" />
          {config.label}
        </Badge>
      </div>

      {/* Additional Status Info */}
      <div className="mt-4 space-y-2">
        {/* Next billing date */}
        {currentPeriodEnd && status === 'active' && !cancelAtPeriodEnd && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              Renews on {format(new Date(currentPeriodEnd), 'MMMM d, yyyy')}
            </span>
          </div>
        )}

        {/* Canceling at period end */}
        {cancelAtPeriodEnd && currentPeriodEnd && (
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <XCircle className="h-4 w-4" />
            <span>
              Cancels on {format(new Date(currentPeriodEnd), 'MMMM d, yyyy')}
            </span>
          </div>
        )}

        {/* Paused */}
        {status === 'paused' && pauseResumesAt && (
          <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
            <RefreshCcw className="h-4 w-4" />
            <span>
              Resumes on {format(new Date(pauseResumesAt), 'MMMM d, yyyy')}
            </span>
          </div>
        )}

        {/* Past due warning */}
        {status === 'past_due' && (
          <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            <AlertTriangle className="mb-1 inline h-4 w-4" />
            <span className="ml-1">
              Payment failed. Please update your payment method to avoid service interruption.
            </span>
          </div>
        )}

        {/* Canceled info */}
        {status === 'canceled' && (
          <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
            <XCircle className="mb-1 inline h-4 w-4" />
            <span className="ml-1">
              Your subscription has been canceled. Subscribe again to continue using OpenAlert.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default SubscriptionStatus;









