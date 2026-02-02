import { format } from 'date-fns';
import { Opening } from '@/types/openings';
import { cn } from '@/lib/utils';

interface OpeningCardProps {
  opening: Opening;
  onClick: () => void;
  style?: React.CSSProperties;
  isHighlighted?: boolean;
  staffName?: string;
}

export const OpeningCard = ({ opening, onClick, style, isHighlighted, staffName }: OpeningCardProps) => {
  const isSmallCard = opening.duration_minutes < 30;
  const title = opening.appointment_name || 'Opening';
  const titleWithStaff = staffName ? `${title} • ${staffName}` : title;
  
  const statusStyles = {
    open: 'bg-accent/5 border-accent/20 hover:bg-accent/10 dark:bg-accent/10 dark:border-accent/30 dark:hover:bg-accent/15',
    booked: 'bg-primary/5 border-primary/20 hover:bg-primary/10 dark:bg-primary/10 dark:border-primary/30 dark:hover:bg-primary/15',
    pending_confirmation: 'bg-pending/5 border-pending/20 hover:bg-pending/10 dark:bg-pending/10 dark:border-pending/30 dark:hover:bg-pending/15',
  };

  const statusColors = {
    open: 'bg-accent',
    booked: 'bg-primary',
    pending_confirmation: 'bg-pending',
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
        {titleWithStaff}
      </p>
    </div>
  );
};
