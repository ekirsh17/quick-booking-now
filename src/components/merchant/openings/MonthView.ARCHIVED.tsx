/*
 * ============================================
 * ARCHIVED: MonthView Component
 * ============================================
 * This component has been removed from the active UI but preserved for future use.
 * 
 * Reason: For a "last-minute booking" system, month view was deemed excessive.
 * The day, week, and agenda views provide sufficient visibility for immediate bookings.
 * 
 * To restore this view:
 * 1. Rename this file back to MonthView.tsx
 * 2. Update OpeningsCalendar.tsx to import and include the month view case
 * 3. Update OpeningsHeader.tsx to add 'month' to the view type and add the "Mo" button
 * 4. Update Openings.tsx to add 'month' to the view type and update dateRange/navigation logic
 * 
 * Last archived: 2025
 * ============================================
 */

import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isToday, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Opening } from '@/types/openings';
import { CalendarLegend } from './CalendarLegend';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthViewProps {
  currentDate: Date;
  openings: Opening[];
  onDateClick: (date: Date) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}

export const MonthView = ({ currentDate, openings, onDateClick, onPreviousMonth, onNextMonth }: MonthViewProps) => {
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
    const openCount = dayOpenings.filter(o => o.status === 'open').length;
    const pendingCount = dayOpenings.filter(o => o.status === 'pending_confirmation').length;
    const bookedCount = dayOpenings.filter(o => o.status === 'booked').length;

    return { 
      openCount,
      pendingCount,
      bookedCount,
      totalCount: dayOpenings.length 
    };
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Calendar header with navigation - more compact */}
      <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onPreviousMonth}
            className="h-7 w-7 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="font-medium text-foreground text-sm">
            {format(currentDate, 'MMMM yyyy')}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onNextMonth}
            className="h-7 w-7 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dayOpenings = getOpeningsForDay(day);
          const { openCount, pendingCount, bookedCount, totalCount } = getStatusInfo(dayOpenings);
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
              {totalCount > 0 && isCurrentMonth && (
                <div className="space-y-1">
                  {/* Show openings count if any */}
                  {openCount > 0 && (
                    <div className="text-[11px] text-accent font-medium">
                      {openCount} open
                    </div>
                  )}
                  {/* Show bookings count if any */}
              {bookedCount > 0 && (
                <div className="text-[11px] text-blue-500">
                  {bookedCount} booked
                </div>
              )}
                  {/* Show pending count if any */}
                  {pendingCount > 0 && (
                    <div className="text-[11px] text-amber-600 dark:text-amber-400">
                      {pendingCount} pending
                    </div>
                  )}
                  {/* Status dots */}
                  <div className="flex gap-1 pt-0.5">
                    {openCount > 0 && (
                      <div className="w-2 h-2 rounded-full bg-accent" title="Open slots" />
                    )}
                    {pendingCount > 0 && (
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Pending confirmation" />
                    )}
                    {bookedCount > 0 && (
                      <div className="w-2 h-2 rounded-full bg-blue-500" title="Booked" />
                    )}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend Footer */}
      <div className="border-t border-border bg-muted/30 px-4 py-2.5 flex items-center justify-start">
        <CalendarLegend compact />
      </div>
    </div>
  );
};
