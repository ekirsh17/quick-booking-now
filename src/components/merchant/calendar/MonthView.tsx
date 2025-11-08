import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameMonth, isToday, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface MonthViewProps {
  date: Date;
  slots: any[];
  onDateClick: (date: Date) => void;
}

export const MonthView = ({ date, slots, onDateClick }: MonthViewProps) => {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getSlotCountForDay = (day: Date) => {
    return slots.filter(slot => isSameDay(new Date(slot.startTime), day));
  };

  const getStatusDots = (daySlots: any[]) => {
    const hasOpen = daySlots.some(s => s.status === 'open');
    const hasPending = daySlots.some(s => s.status === 'pending_confirmation');
    const hasBooked = daySlots.some(s => s.status === 'booked');

    return (
      <div className="flex gap-1 justify-center mt-1">
        {hasOpen && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
        {hasPending && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
        {hasBooked && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
      </div>
    );
  };

  return (
    <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
      {/* Weekday Headers */}
      <div className="grid grid-cols-7 border-b bg-muted/50">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="p-2 text-center text-xs font-semibold text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const daySlots = getSlotCountForDay(day);
          const isCurrentMonth = isSameMonth(day, date);
          const isCurrentDay = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateClick(day)}
              className={cn(
                "aspect-square p-2 border-r border-b hover:bg-accent transition-colors text-center relative",
                !isCurrentMonth && "bg-muted/20 text-muted-foreground",
                isCurrentDay && "bg-primary/5"
              )}
            >
              <div className={cn(
                "text-sm font-medium mb-1",
                isCurrentDay && "text-primary font-bold"
              )}>
                {format(day, 'd')}
              </div>
              
              {daySlots.length > 0 && (
                <>
                  {getStatusDots(daySlots)}
                  <div className="text-xs text-muted-foreground mt-1">
                    {daySlots.length} {daySlots.length === 1 ? 'slot' : 'slots'}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
