import { DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SavingsSummaryProps {
  slotsFilled: number;
  estimatedRevenue: number;
  avgAppointmentValue: number;
  loading?: boolean;
}

/**
 * Displays a summary of value/savings from using the service.
 * Inspired by Uber Eats/Instacart/Amazon Prime retention patterns.
 */
export function SavingsSummary({
  slotsFilled,
  estimatedRevenue,
  avgAppointmentValue,
  loading,
}: SavingsSummaryProps) {
  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-6 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded mb-4" />
        <div className="h-10 w-24 bg-muted rounded" />
      </div>
    );
  }

  // Don't show if no value yet
  if (slotsFilled === 0 && estimatedRevenue === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border bg-gradient-to-br from-emerald-50/50 to-background dark:from-emerald-950/20 p-6">
      {/* Header with value message */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
          <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h4 className="font-medium text-sm">Your NotifyMe Value</h4>
          <p className="text-xs text-muted-foreground">Revenue recovered from last-minute openings</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Revenue Recovered - Hero stat */}
        <div className="col-span-2 rounded-lg bg-emerald-100/50 dark:bg-emerald-900/20 p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
              {estimatedRevenue.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            Revenue Recovered
          </p>
        </div>

        {/* Secondary stats */}
        <div className="rounded-lg bg-muted/30 p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-xl font-semibold">{slotsFilled}</span>
          </div>
          <p className="text-xs text-muted-foreground">Openings Filled</p>
        </div>

        <div className="rounded-lg bg-muted/30 p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-xl font-semibold">{avgAppointmentValue}</span>
          </div>
          <p className="text-xs text-muted-foreground">Avg. Value</p>
        </div>
      </div>

      {/* Motivational message */}
      {estimatedRevenue > 0 && (
        <p className="mt-4 text-xs text-center text-muted-foreground">
          {estimatedRevenue >= 500 
            ? "You're getting serious value from NotifyMe!"
            : estimatedRevenue >= 100
              ? "Great progress! Keep filling those last-minute openings."
              : "Every filled opening counts. Keep it up!"}
        </p>
      )}
    </div>
  );
}

export default SavingsSummary;

