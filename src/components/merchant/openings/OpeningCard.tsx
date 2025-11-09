import { format } from 'date-fns';
import { Opening } from '@/types/openings';
import { cn } from '@/lib/utils';

interface OpeningCardProps {
  opening: Opening;
  onClick: () => void;
  style?: React.CSSProperties;
}

export const OpeningCard = ({ opening, onClick, style }: OpeningCardProps) => {
  const startTime = new Date(opening.start_time);
  const endTime = new Date(opening.end_time);
  
  const statusStyles = {
    open: 'bg-accent/10 border-accent/30 hover:bg-accent/20',
    booked: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    pending_confirmation: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
  };

  const statusColors = {
    open: 'bg-accent',
    booked: 'bg-blue-500',
    pending_confirmation: 'bg-amber-500',
  };

  return (
    <div
      onClick={onClick}
      style={style}
      className={cn(
        'absolute left-[68px] right-4 rounded-lg p-3 cursor-pointer transition-all border',
        'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
        statusStyles[opening.status]
      )}
    >
      {/* Accent bar */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-lg', statusColors[opening.status])} />
      
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground truncate">
          {opening.appointment_name || 'Opening'}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
        </p>
        <p className="text-xs text-muted-foreground">
          {opening.duration_minutes} min
        </p>
        {opening.status === 'booked' && opening.booked_by_name && (
          <p className="text-xs font-medium text-blue-700">
            {opening.booked_by_name}
          </p>
        )}
      </div>
    </div>
  );
};
