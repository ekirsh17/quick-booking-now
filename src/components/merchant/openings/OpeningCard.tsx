import { format } from 'date-fns';
import { Opening } from '@/types/openings';
import { cn } from '@/lib/utils';

interface OpeningCardProps {
  opening: Opening;
  onClick: () => void;
  style?: React.CSSProperties;
  isHighlighted?: boolean;
}

export const OpeningCard = ({ opening, onClick, style, isHighlighted }: OpeningCardProps) => {
  const isSmallCard = opening.duration_minutes < 30;
  
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
      style={{ ...style, minHeight: '28px' }}
      className={cn(
        'absolute rounded-md cursor-pointer transition-all border overflow-hidden pointer-events-auto',
        'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
        'flex items-center',
        isSmallCard ? 'p-2' : 'p-3',
        isHighlighted && 'animate-pulse ring-2 ring-accent ring-offset-2',
        statusStyles[opening.status]
      )}
    >
      {/* Accent bar */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-1.5 rounded-l-md', statusColors[opening.status])} />
      
      <p className={cn(
        'font-semibold text-foreground truncate line-clamp-1 w-full',
        opening.duration_minutes < 20 ? 'text-xs' : 'text-sm'
      )}>
        {opening.appointment_name || 'Opening'}
      </p>
    </div>
  );
};
