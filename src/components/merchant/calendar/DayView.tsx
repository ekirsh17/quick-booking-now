import { format, isSameDay, isToday } from 'date-fns';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DayViewProps {
  date: Date;
  slots: any[];
  onEventClick: (slot: any) => void;
  onEmptySlotClick?: (time: Date) => void;
  workingHours?: any;
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7am to 8pm

export const DayView = ({ 
  date, 
  slots, 
  onEventClick, 
  onEmptySlotClick,
  workingHours 
}: DayViewProps) => {
  const daySlots = slots.filter(slot => 
    isSameDay(new Date(slot.startTime), date)
  );

  // Get slots for a specific hour
  const getSlotsForHour = (hour: number) => {
    return daySlots.filter(slot => {
      const start = new Date(slot.startTime);
      return start.getHours() === hour;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-emerald-500 text-white border-emerald-600';
      case 'pending_confirmation':
        return 'bg-amber-500 text-white border-amber-600';
      case 'booked':
        return 'bg-blue-500 text-white border-blue-600';
      default:
        return 'bg-muted hover:bg-muted/80';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-emerald-500';
      case 'pending_confirmation':
        return 'bg-amber-500';
      case 'booked':
        return 'bg-blue-500';
      default:
        return 'bg-muted';
    }
  };

  const handleEmptyClick = (hour: number) => {
    if (onEmptySlotClick) {
      const clickedTime = new Date(date);
      clickedTime.setHours(hour, 0, 0, 0);
      onEmptySlotClick(clickedTime);
    }
  };

  const getCurrentHour = () => {
    if (!isToday(date)) return null;
    const now = new Date();
    const hour = now.getHours();
    return hour >= 7 && hour < 21 ? hour : null;
  };

  const currentHour = getCurrentHour();

  return (
    <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
      {/* Header - matches MonthView weekday header */}
      <div className="border-b bg-muted/50">
        <div className="p-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {format(date, 'EEEE')}
          </div>
          <div className={cn(
            "text-2xl font-bold mt-1",
            isToday(date) && "text-primary"
          )}>
            {format(date, 'MMM d, yyyy')}
          </div>
        </div>
      </div>

      {/* Time Grid - matches MonthView grid structure */}
      <div className="divide-y divide-border">
        {HOURS.map((hour) => {
          const hourSlots = getSlotsForHour(hour);
          const isCurrentHour = currentHour === hour;

          return (
            <button
              key={hour}
              className={cn(
                "w-full p-4 text-left hover:bg-accent transition-colors border-b last:border-b-0",
                isCurrentHour && "bg-primary/5"
              )}
              onClick={() => handleEmptyClick(hour)}
            >
              <div className="flex items-start gap-4">
                {/* Time Label */}
                <div className={cn(
                  "text-xs font-semibold text-muted-foreground min-w-[70px]",
                  isCurrentHour && "text-primary"
                )}>
                  {format(new Date().setHours(hour, 0, 0, 0), 'h:mm a')}
                </div>

                {/* Slots Container */}
                <div className="flex-1 min-h-[40px]">
                  {hourSlots.length > 0 ? (
                    <div className="space-y-2">
                      {hourSlots.map((slot) => (
                        <div
                          key={slot.id}
                          className={cn(
                            "rounded-md p-3 shadow-sm border cursor-pointer transition-all hover:shadow-md",
                            getStatusColor(slot.status)
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(slot);
                          }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-1.5 h-1.5 rounded-full", getStatusDot(slot.status))} />
                              <span className="text-xs font-bold">
                                {format(new Date(slot.startTime), 'h:mm a')} - {format(new Date(slot.endTime), 'h:mm a')}
                              </span>
                            </div>
                            <span className="text-xs opacity-90">
                              {slot.durationMinutes} min
                            </span>
                          </div>
                          
                          {slot.appointmentName && (
                            <div className="text-sm font-semibold mb-1">
                              {slot.appointmentName}
                            </div>
                          )}
                          
                          {slot.customer && (
                            <div className="text-xs opacity-90">
                              {slot.customer}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center h-[40px] text-xs text-muted-foreground">
                      No openings
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Empty State */}
      {daySlots.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm font-medium">No openings for this day</p>
            <p className="text-xs mt-1">Click on a time slot to create one</p>
          </div>
        </div>
      )}
    </div>
  );
};
