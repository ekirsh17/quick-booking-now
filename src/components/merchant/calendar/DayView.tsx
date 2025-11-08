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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-emerald-500 hover:bg-emerald-600 border-emerald-600';
      case 'pending_confirmation':
        return 'bg-amber-500 hover:bg-amber-600 border-amber-600 animate-pulse';
      case 'booked':
        return 'bg-blue-500 hover:bg-blue-600 border-blue-600';
      default:
        return 'bg-muted hover:bg-muted/80';
    }
  };

  const getSlotPosition = (slot: any) => {
    const start = new Date(slot.startTime);
    const hour = start.getHours();
    const minute = start.getMinutes();
    const top = ((hour - 7) * 60 + minute) * (60 / 60); // 60px per hour
    const duration = slot.durationMinutes || 30;
    const height = (duration / 60) * 60;
    
    return { top, height };
  };

  const handleEmptyClick = (hour: number) => {
    if (onEmptySlotClick) {
      const clickedTime = new Date(date);
      clickedTime.setHours(hour, 0, 0, 0);
      onEmptySlotClick(clickedTime);
    }
  };

  const getCurrentTimePosition = () => {
    const now = new Date();
    if (!isSameDay(now, date)) return null;
    
    const hour = now.getHours();
    const minute = now.getMinutes();
    if (hour < 7 || hour >= 21) return null;
    
    return ((hour - 7) * 60 + minute);
  };

  const currentTimePos = getCurrentTimePosition();

  return (
    <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
      {/* Header */}
      <div className={cn(
        "p-4 border-b",
        isToday(date) && "bg-primary/5"
      )}>
        <div className="text-sm text-muted-foreground font-medium">
          {format(date, 'EEEE')}
        </div>
        <div className={cn(
          "text-2xl font-bold",
          isToday(date) && "text-primary"
        )}>
          {format(date, 'MMM d')}
        </div>
      </div>

      {/* Time Grid */}
      <div className="relative" style={{ height: '840px' }}>
        {/* Hour Lines */}
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="absolute left-0 right-0 border-t border-border/50"
            style={{ top: `${(hour - 7) * 60}px` }}
            onClick={() => handleEmptyClick(hour)}
          >
            <div className="absolute -top-2 left-2 text-xs text-muted-foreground bg-card px-1">
              {format(new Date().setHours(hour, 0, 0, 0), 'h:mm a')}
            </div>
          </div>
        ))}

        {/* Current Time Indicator */}
        {currentTimePos !== null && (
          <div
            className="absolute left-0 right-0 border-t-2 border-red-500 z-20"
            style={{ top: `${currentTimePos}px` }}
          >
            <div className="absolute -top-1 left-0 w-2 h-2 bg-red-500 rounded-full" />
          </div>
        )}

        {/* Slots */}
        <div className="absolute left-16 right-4 top-0 bottom-0">
          {daySlots.map((slot) => {
            const { top, height } = getSlotPosition(slot);
            return (
              <button
                key={slot.id}
                className={cn(
                  "absolute left-0 right-0 rounded-md text-white p-2 text-left text-sm shadow-md transition-all cursor-pointer z-10",
                  getStatusColor(slot.status)
                )}
                style={{ 
                  top: `${top}px`, 
                  height: `${height}px`,
                  minHeight: '40px'
                }}
                onClick={() => onEventClick(slot)}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="h-3 w-3" />
                  <div className="font-bold text-xs">
                    {format(new Date(slot.startTime), 'h:mm a')}
                  </div>
                </div>
                {slot.appointmentName && (
                  <div className="font-semibold truncate text-sm">
                    {slot.appointmentName}
                  </div>
                )}
                {slot.bookedByName && (
                  <div className="text-xs opacity-90 truncate">
                    {slot.bookedByName}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Empty State */}
        {daySlots.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No openings for this day</p>
              <p className="text-xs mt-1">Tap on a time to create one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
