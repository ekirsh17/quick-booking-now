import { cn } from '@/lib/utils';
import { openingsTokens } from './openingsTokens';

interface OpeningBlockProps {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  title?: string;
  status: 'open' | 'pending_confirmation' | 'booked';
  onClick: () => void;
  column?: number;
  totalColumns?: number;
}

export const OpeningBlock = ({
  startHour,
  startMinute,
  endHour,
  endMinute,
  title,
  status,
  onClick,
  column = 0,
  totalColumns = 1,
}: OpeningBlockProps) => {
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  const durationMinutes = endMinutes - startMinutes;
  
  // Position calculations (each hour = 60px)
  const top = (startMinutes / 60) * 60;
  const height = (durationMinutes / 60) * 60;
  
  // Column positioning for overlaps
  const columnWidth = totalColumns > 1 ? `${100 / totalColumns}%` : '100%';
  const leftOffset = totalColumns > 1 ? `${(column / totalColumns) * 100}%` : '0';
  
  const getStatusColors = () => {
    switch (status) {
      case 'open':
        return 'bg-emerald-500/10 border-l-emerald-500';
      case 'pending_confirmation':
        return 'bg-amber-300/10 border-l-amber-300';
      case 'booked':
        return 'bg-blue-500/10 border-l-blue-500';
      default:
        return 'bg-primary/10 border-l-primary';
    }
  };

  const formatTime = (hour: number, minute: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "absolute border-l-2 rounded-md overflow-hidden transition-all",
        "hover:shadow-md hover:z-20",
        getStatusColors(),
        totalColumns > 1 && "min-w-[44px]"
      )}
      style={{
        top: `${top}px`,
        height: `${Math.max(height, 20)}px`,
        left: leftOffset,
        width: columnWidth,
        paddingLeft: '6px',
        paddingRight: totalColumns > 1 ? '4px' : '8px',
      }}
    >
      <div className="h-full flex flex-col justify-start py-1">
        <div className="text-[11px] font-medium leading-tight truncate">
          {title || 'Opening'}
        </div>
        {height > 25 && (
          <div className="text-[10px] text-muted-foreground leading-tight">
            {formatTime(startHour, startMinute)}
          </div>
        )}
        {height > 40 && (
          <div className="text-[10px] text-muted-foreground leading-tight">
            {durationMinutes} min
          </div>
        )}
      </div>
    </button>
  );
};
