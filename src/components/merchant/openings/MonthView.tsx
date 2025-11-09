import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isToday, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Opening } from '@/types/openings';

interface MonthViewProps {
  currentDate: Date;
  openings: Opening[];
  onDateClick: (date: Date) => void;
}

export const MonthView = ({ currentDate, openings, onDateClick }: MonthViewProps) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getOpeningsForDay = (day: Date) => {
    return openings.filter(opening => 
      isSameDay(new Date(opening.start_time), day)
    );
  };

  const getStatusInfo = (dayOpenings: Opening[]) => {
    const hasOpen = dayOpenings.some(o => o.status === 'open');
    const hasPending = dayOpenings.some(o => o.status === 'pending_confirmation');
    const hasBooked = dayOpenings.some(o => o.status === 'booked');

    return { hasOpen, hasPending, hasBooked, count: dayOpenings.length };
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Calendar header matching Day/Week view style */}
      <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="font-medium text-foreground text-sm">
          {format(currentDate, 'MMMM yyyy')}
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="py-3 px-2 text-center text-xs font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dayOpenings = getOpeningsForDay(day);
          const { hasOpen, hasPending, hasBooked, count } = getStatusInfo(dayOpenings);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateClick(day)}
              className={cn(
                'relative min-h-[80px] md:min-h-[100px] p-2 border-b border-r border-border',
                'hover:bg-accent/5 transition-colors text-left',
                !isCurrentMonth && 'bg-muted/20 text-muted-foreground',
                isCurrentDay && 'bg-primary/5 ring-1 ring-primary/20 ring-inset',
                index % 7 === 6 && 'border-r-0'
              )}
            >
              {/* Day number */}
              <div className={cn(
                'text-sm font-medium mb-1',
                isCurrentDay && 'text-primary font-semibold',
                !isCurrentMonth && 'text-muted-foreground/60'
              )}>
                {format(day, 'd')}
              </div>

              {/* Opening count and status dots */}
              {count > 0 && isCurrentMonth && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">
                    {count} {count === 1 ? 'slot' : 'slots'}
                  </div>
                  <div className="flex gap-1">
                    {hasOpen && (
                      <div className="w-2 h-2 rounded-full bg-accent" />
                    )}
                    {hasPending && (
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    )}
                    {hasBooked && (
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
