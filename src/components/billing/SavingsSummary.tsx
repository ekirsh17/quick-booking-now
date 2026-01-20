import { Bell, CalendarCheck, DollarSign, TrendingUp } from 'lucide-react';

interface SavingsSummaryProps {
  slotsFilled: number;
  estimatedRevenue: number;
  notificationsSent: number;
  loading?: boolean;
  hideHeader?: boolean;
}

/**
 * Displays a summary of value/savings from using the service.
 * Inspired by Uber Eats/Instacart/Amazon Prime retention patterns.
 */
export function SavingsSummary({
  slotsFilled,
  estimatedRevenue,
  notificationsSent,
  loading,
  hideHeader = false,
}: SavingsSummaryProps) {
  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-6 animate-pulse">
        <div className="h-4 w-40 bg-muted rounded mb-4" />
        <div className="h-10 w-32 bg-muted rounded" />
      </div>
    );
  }

  // Don't show if no value yet
  if (slotsFilled === 0 && estimatedRevenue === 0 && notificationsSent === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border bg-card p-6">
      {!hideHeader && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h4 className="font-medium text-sm">Value generated so far</h4>
            <p className="text-xs text-muted-foreground">
              Revenue recovered from last-minute cancellations
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-emerald-100/50 dark:bg-emerald-900/20 p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              ${estimatedRevenue.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            Revenue Recovered
          </p>
        </div>

        <div className="rounded-lg bg-muted/30 p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
            <span className="text-2xl font-semibold">{slotsFilled}</span>
          </div>
          <p className="text-xs text-muted-foreground">Openings Filled</p>
        </div>

        <div className="rounded-lg bg-muted/30 p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-2xl font-semibold">{notificationsSent}</span>
          </div>
          <p className="text-xs text-muted-foreground">Notifications Sent</p>
        </div>
      </div>
    </div>
  );
}

export default SavingsSummary;
