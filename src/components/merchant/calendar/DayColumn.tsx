import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DayColumnProps {
  date: Date;
  slots: any[];
  onEventClick: (slot: any) => void;
  onSelectSlot?: (slotInfo: { start: Date; end: Date }) => void;
}

export const DayColumn = ({ date, slots, onEventClick, onSelectSlot }: DayColumnProps) => {
  const isToday = isSameDay(date, new Date());

  const handleAddOpening = () => {
    if (!onSelectSlot) return;
    
    // Create default time slot at next available hour or 9am
    const now = new Date();
    const startTime = new Date(date);
    
    if (isSameDay(date, now)) {
      // If today, use next hour
      startTime.setHours(now.getHours() + 1, 0, 0, 0);
    } else {
      // Otherwise, default to 9am
      startTime.setHours(9, 0, 0, 0);
    }
    
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + 30); // Default 30 min
    
    onSelectSlot({ start: startTime, end: endTime });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-chart-2 hover:opacity-90';
      case 'pending_confirmation':
        return 'bg-chart-3 hover:opacity-90';
      case 'booked':
        return 'bg-chart-1 hover:opacity-90';
      default:
        return 'bg-chart-2 hover:opacity-90';
    }
  };

  return (
    <div className={cn(
      "bg-card rounded-lg p-3 min-h-[400px] border transition-colors",
      isToday && "border-2 border-primary"
    )}>
      {/* Day Header */}
      <div className="text-center mb-3 pb-2 border-b">
        <div className={cn(
          "text-xs font-medium uppercase tracking-wider",
          isToday ? "text-primary" : "text-muted-foreground"
        )}>
          {format(date, 'EEE')}
        </div>
        <div className={cn(
          "text-2xl font-bold mt-1",
          isToday && "text-primary"
        )}>
          {format(date, 'd')}
        </div>
      </div>

      {/* Slots */}
      <div className="space-y-2">
        {slots.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-8">
            No openings
          </div>
        ) : (
          slots.map(slot => (
            <button
              key={slot.id}
              onClick={() => onEventClick(slot)}
              className={cn(
                "w-full text-left p-2.5 rounded-md text-xs transition-all text-white",
                getStatusColor(slot.status)
              )}
            >
              <div className="font-semibold mb-1">
                {format(new Date(slot.startTime), 'h:mm a')}
              </div>
              {slot.appointmentName && (
                <div className="truncate text-white/90 text-[11px]">
                  {slot.appointmentName}
                </div>
              )}
              {slot.customer && (
                <div className="truncate text-white/80 text-[10px] mt-1">
                  {slot.customer}
                </div>
              )}
            </button>
          ))
        )}
        
        {/* Add Opening Button */}
        {onSelectSlot && (
          <Button
            onClick={handleAddOpening}
            variant="outline"
            size="sm"
            className="w-full mt-3 gap-2"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Opening
          </Button>
        )}
      </div>
    </div>
  );
};
