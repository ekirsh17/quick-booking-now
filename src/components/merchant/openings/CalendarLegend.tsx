import { cn } from '@/lib/utils';

interface CalendarLegendProps {
  className?: string;
  compact?: boolean;
}

export const CalendarLegend = ({ className, compact = false }: CalendarLegendProps) => {
  if (compact) {
    return (
      <div className={cn("flex items-center gap-3 text-xs", className)}>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-accent" />
          <span className="text-muted-foreground">Open</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
          <span className="text-muted-foreground">Booked</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
          <span className="text-muted-foreground">Pending</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-4 px-4 py-2 rounded-lg bg-muted/30 border border-border", className)}>
      <span className="text-xs font-medium text-muted-foreground">Legend:</span>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-accent" />
        <span className="text-sm text-foreground">Open</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-blue-500" />
        <span className="text-sm text-foreground">Booked</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-amber-500" />
        <span className="text-sm text-foreground">Pending</span>
      </div>
    </div>
  );
};
