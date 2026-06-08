import { useState } from 'react';
import { format } from 'date-fns';
import { Opening } from '@/types/openings';
import { OpeningCard } from './OpeningCard';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface OverflowGroupProps {
  visibleOpening: Opening;
  hiddenOpenings: Opening[];
  wrapperStyle: React.CSSProperties;
  isHighlighted: boolean;
  getStaffName?: (staffId: string | null) => string | null;
  onOpeningClick: (opening: Opening) => void;
  isWeekView?: boolean;
}

export const OverflowGroup = ({
  visibleOpening,
  hiddenOpenings,
  wrapperStyle,
  isHighlighted,
  getStaffName,
  onOpeningClick,
  isWeekView = false,
}: OverflowGroupProps) => {
  const [open, setOpen] = useState(false);
  const hiddenCountDigits = String(hiddenOpenings.length).length;
  const estimatedChipWidth = hiddenCountDigits >= 3 ? 46 : hiddenCountDigits === 2 ? 40 : 34;
  const reservedTextSpace = Math.max(30, isWeekView ? estimatedChipWidth - 2 : estimatedChipWidth + 2);

  const statusColors = {
    open: 'bg-accent',
    booked: 'bg-primary',
    pending_confirmation: 'bg-pending',
    pending_external_booking: 'bg-amber-500',
  };

  return (
    <div
      style={wrapperStyle}
      className={cn(
        'absolute',
        isWeekView ? 'pointer-events-none' : ''
      )}
    >
      <OpeningCard
        opening={visibleOpening}
        onClick={() => onOpeningClick(visibleOpening)}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          minHeight: '28px',
          paddingRight: `${reservedTextSpace}px`,
        }}
        isHighlighted={isHighlighted}
        staffName={getStaffName?.(visibleOpening.staff_id) ?? undefined}
      />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'absolute top-1/2 -translate-y-1/2 z-10 pointer-events-auto inline-flex items-center justify-center rounded-md border border-border bg-background text-foreground shadow-sm ring-1 ring-border/60 transition-colors hover:bg-muted hover:border-foreground/20 cursor-pointer whitespace-nowrap font-bold',
              isWeekView
                ? 'right-1.5 h-6 min-w-9 px-1.5 text-[11px]'
                : 'right-1.5 h-5 sm:h-6 min-w-8 sm:min-w-9 px-1 sm:px-1.5 text-[10px] sm:text-[11px]'
            )}
            aria-label={`${hiddenOpenings.length} more openings`}
            onClick={(e) => e.stopPropagation()}
          >
            +{hiddenOpenings.length}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[min(19rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] sm:w-[min(21rem,calc(100vw-1.5rem))] sm:max-w-[calc(100vw-1.5rem)] p-0 overflow-hidden border-border/80 shadow-lg"
          align="end"
          side="bottom"
          sideOffset={6}
          collisionPadding={8}
        >
          <div className="px-3 py-2 border-b border-border bg-muted/40">
            <p className="text-xs font-bold text-foreground/80 uppercase tracking-wide">
              {hiddenOpenings.length} more opening{hiddenOpenings.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="max-h-52 overflow-y-auto">
            {hiddenOpenings.map((opening) => {
              const staffName = getStaffName?.(opening.staff_id) ?? null;
              return (
                <button
                  key={opening.id}
                  className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left border-b border-border/40 last:border-b-0"
                  onClick={() => {
                    onOpeningClick(opening);
                    setOpen(false);
                  }}
                >
                  <div
                    className={cn(
                      'mt-1.5 w-2 h-2 rounded-full flex-shrink-0',
                      statusColors[opening.status]
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate leading-tight">
                      {opening.appointment_name || 'Opening'}
                      {staffName ? ` · ${staffName}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(opening.start_time), 'h:mm a')}
                      {' – '}
                      {format(new Date(opening.end_time), 'h:mm a')}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
