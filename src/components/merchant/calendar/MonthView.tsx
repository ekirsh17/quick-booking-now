import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameMonth, isToday, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { openingsTokens } from './openingsTokens';

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
      <div className={openingsTokens.status.dotGroup}>
        {hasOpen && <div className={cn(openingsTokens.status.dot, openingsTokens.status.colors.open)} />}
        {hasPending && <div className={cn(openingsTokens.status.dot, openingsTokens.status.colors.pending)} />}
        {hasBooked && <div className={cn(openingsTokens.status.dot, openingsTokens.status.colors.booked)} />}
      </div>
    );
  };

  return (
    <div className={openingsTokens.card.wrapper}>
      {/* Weekday Headers */}
      <div className={openingsTokens.grid.headerRow}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className={openingsTokens.grid.headerCell}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className={openingsTokens.grid.bodyGrid}>
        {days.map((day) => {
          const daySlots = getSlotCountForDay(day);
          const isCurrentMonth = isSameMonth(day, date);
          const isCurrentDay = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateClick(day)}
              className={cn(
                openingsTokens.grid.cell,
                !isCurrentMonth && openingsTokens.grid.cellOutOfRange,
                isCurrentDay && openingsTokens.grid.cellToday
              )}
            >
              <div className={cn(
                isCurrentDay ? openingsTokens.typography.dateNumberToday : openingsTokens.typography.dateNumber,
                "mb-1"
              )}>
                {format(day, 'd')}
              </div>
              
              {daySlots.length > 0 && (
                <>
                  {getStatusDots(daySlots)}
                  <div className={cn(openingsTokens.typography.slotCount, "mt-1")}>
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
