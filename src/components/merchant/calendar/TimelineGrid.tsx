import { format, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { openingsTokens } from './openingsTokens';

interface TimelineGridProps {
  date: Date;
  onTimeClick?: (hour: number, minute: number) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const QUARTER_MARKS = [0, 15, 30, 45];

export const TimelineGrid = ({ date, onTimeClick }: TimelineGridProps) => {
  const now = new Date();
  const showCurrentTime = isToday(date);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTimePosition = (currentMinutes / (24 * 60)) * 100;

  return (
    <div className="relative">
      {HOURS.map((hour) => (
        <div key={hour} className="relative" style={{ height: '60px' }}>
          {/* Hour border */}
          <div className="absolute top-0 left-0 right-0 border-t border-neutral-200/70" />
          
          {/* Quarter hour marks */}
          {QUARTER_MARKS.slice(1).map((minute) => (
            <div
              key={minute}
              className={cn(
                "absolute left-0 right-0",
                minute === 30 ? "border-t border-neutral-200/50" : "border-t border-neutral-200/30"
              )}
              style={{ top: `${(minute / 60) * 100}%` }}
            />
          ))}

          {/* Clickable area */}
          {onTimeClick && (
            <button
              className="absolute inset-0 hover:bg-accent/20 transition-colors"
              onClick={() => onTimeClick(hour, 0)}
              aria-label={`Select ${format(new Date().setHours(hour, 0), 'h a')}`}
            />
          )}
        </div>
      ))}

      {/* Current time indicator */}
      {showCurrentTime && (
        <>
          <div
            className="absolute left-0 right-0 z-30 pointer-events-none"
            style={{ top: `${currentTimePosition}%` }}
          >
            {/* Dot */}
            <div className="absolute -left-[3px] -top-[3px] w-2 h-2 rounded-full bg-primary" />
            
            {/* Line */}
            <div className="h-[2px] bg-primary/60" />
          </div>

          {/* Screen reader announcement */}
          <div className="sr-only" role="status" aria-live="polite">
            Current time: {format(now, 'h:mm a')}
          </div>
        </>
      )}
    </div>
  );
};
