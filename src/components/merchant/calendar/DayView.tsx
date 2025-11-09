import { format, isSameDay, isToday } from 'date-fns';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { openingsTokens } from './openingsTokens';

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
    const { slotColors } = openingsTokens.status;
    return slotColors[status as keyof typeof slotColors] || 'bg-muted hover:bg-muted/80';
  };

  const getStatusDot = (status: string) => {
    const { colors } = openingsTokens.status;
    const colorMap = {
      open: colors.open,
      pending_confirmation: colors.pending,
      booked: colors.booked,
    };
    return colorMap[status as keyof typeof colorMap] || 'bg-muted';
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
    <div className={openingsTokens.card.wrapper}>
      {/* Header - matches MonthView weekday header style */}
      <div className={cn(openingsTokens.grid.headerRow, "grid-cols-1")}>
        <div className={openingsTokens.grid.headerCell}>
          {format(date, 'EEE')}
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
                openingsTokens.slot.row,
                isCurrentHour && openingsTokens.slot.rowCurrent
              )}
              onClick={() => handleEmptyClick(hour)}
            >
              <div className="flex items-start gap-4">
                {/* Time Label */}
                <div className={cn(
                  openingsTokens.grid.timeCol.width,
                  openingsTokens.grid.timeCol.label,
                  isCurrentHour && openingsTokens.grid.timeCol.labelCurrent
                )}>
                  {format(new Date().setHours(hour, 0, 0, 0), 'h:mm a')}
                </div>

                {/* Slots Container */}
                <div className={openingsTokens.slot.container}>
                  {hourSlots.length > 0 ? (
                    <div className="space-y-2">
                      {hourSlots.map((slot) => (
                        <div
                          key={slot.id}
                          className={cn(
                            openingsTokens.slot.wrapper,
                            getStatusColor(slot.status)
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(slot);
                          }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className={cn(openingsTokens.status.dot, getStatusDot(slot.status))} />
                              <span className={openingsTokens.typography.slotTime}>
                                {format(new Date(slot.startTime), 'h:mm a')} - {format(new Date(slot.endTime), 'h:mm a')}
                              </span>
                            </div>
                            <span className={openingsTokens.typography.slotDuration}>
                              {slot.durationMinutes} min
                            </span>
                          </div>
                          
                          {slot.appointmentName && (
                            <div className={openingsTokens.typography.slotName}>
                              {slot.appointmentName}
                            </div>
                          )}
                          
                          {slot.customer && (
                            <div className={openingsTokens.typography.slotCustomer}>
                              {slot.customer}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={openingsTokens.slot.empty}>
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
