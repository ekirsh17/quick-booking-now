import { format, isToday, isTomorrow, isSameDay } from 'date-fns';
import { Opening } from '@/types/openings';
import { cn } from '@/lib/utils';
import { Clock, Edit, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AgendaViewProps {
  currentDate: Date;
  openings: Opening[];
  onOpeningClick: (opening: Opening) => void;
  highlightedOpeningId?: string | null;
  onPreviousDay: () => void;
  onNextDay: () => void;
}

export const AgendaView = ({ 
  currentDate,
  openings, 
  onOpeningClick,
  highlightedOpeningId,
  onPreviousDay,
  onNextDay
}: AgendaViewProps) => {
  // Filter openings for the current date and sort by start_time
  const dayOpenings = openings
    .filter(opening => isSameDay(new Date(opening.start_time), currentDate))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const statusConfig = {
    open: {
      label: 'Open',
      icon: CheckCircle2,
      className: 'bg-accent/10 text-accent border-accent/30',
    },
    booked: {
      label: 'Booked',
      icon: CheckCircle2,
      className: 'bg-success/10 text-success border-success/30',
    },
    pending_confirmation: {
      label: 'Pending',
      icon: AlertCircle,
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    },
  };

  const renderOpening = (opening: Opening) => {
    const status = statusConfig[opening.status];
    const StatusIcon = status.icon;
    const isHighlighted = opening.id === highlightedOpeningId;

    return (
      <div
        key={opening.id}
        onClick={() => onOpeningClick(opening)}
        className={cn(
          'group relative bg-card border border-border rounded-lg p-4',
          'hover:border-accent/50 hover:shadow-md transition-all cursor-pointer',
          'active:scale-[0.98]',
          isHighlighted && 'animate-pulse ring-2 ring-accent ring-offset-2 ring-offset-background'
        )}
      >
        {/* Time & Duration */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 text-foreground">
            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="font-semibold text-base">
                {format(new Date(opening.start_time), 'h:mm a')} - {format(new Date(opening.end_time), 'h:mm a')}
              </p>
              <p className="text-xs text-muted-foreground">
                {opening.duration_minutes} min
              </p>
            </div>
          </div>
          
          <Badge variant="outline" className={cn('flex items-center gap-1.5 px-2 py-1', status.className)}>
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </Badge>
        </div>

        {/* Appointment Name */}
        {opening.appointment_name && (
          <p className="text-sm font-medium text-foreground mb-1">
            {opening.appointment_name}
          </p>
        )}

        {/* Booked By Info */}
        {(opening.status === 'booked' || opening.status === 'pending_confirmation') && opening.booked_by_name && (
          <div className="mt-2 pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {opening.status === 'pending_confirmation' ? 'Requested by' : 'Booked by'}:{' '}
              <span className="font-medium text-foreground">{opening.booked_by_name}</span>
              {opening.consumer_phone && (
                <span className="ml-2">{opening.consumer_phone}</span>
              )}
            </p>
          </div>
        )}

        {/* Edit Button (visible on hover/tap) */}
        <Button
          size="sm"
          variant="ghost"
          className="absolute top-2 right-2 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onOpeningClick(opening);
          }}
        >
          <Edit className="h-4 w-4" />
          <span className="sr-only">Edit opening</span>
        </Button>
      </div>
    );
  };

  const hasAnyOpenings = dayOpenings.length > 0;

  // Get readable date label
  const getDateLabel = () => {
    if (isToday(currentDate)) return 'Today';
    if (isTomorrow(currentDate)) return 'Tomorrow';
    return format(currentDate, 'EEEE, MMMM d, yyyy');
  };

  return (
    <div className="space-y-4">
      {/* Simple header with navigation */}
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onPreviousDay} 
          className="h-8 w-8 p-0"
          aria-label="Previous day"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <h2 className="text-lg font-semibold text-foreground">
          {getDateLabel()}
        </h2>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onNextDay} 
          className="h-8 w-8 p-0"
          aria-label="Next day"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Content area */}
      {!hasAnyOpenings ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Clock className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              No openings {isToday(currentDate) ? 'today' : isTomorrow(currentDate) ? 'tomorrow' : 'on this day'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Create your first opening by clicking the "Add Opening" button
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {dayOpenings.map(opening => renderOpening(opening))}
        </div>
      )}
    </div>
  );
};
