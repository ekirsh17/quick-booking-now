import { useRef, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { openingsTokens } from './openingsTokens';
import { TimelineGrid } from './TimelineGrid';
import { OpeningBlock } from './OpeningBlock';
import { OpeningChip } from './OpeningChip';
import { useTimelineScroll } from './useTimelineScroll';
import { useTimelineGestures, TimeSelection } from './useTimelineGestures';

interface DayMobileProps {
  date: Date;
  slots: any[];
  onEventClick: (slot: any) => void;
  onCreateOpening: (data: { date: Date; startTime: string; endTime: string }) => void;
  onNavigate: (direction: 'prev' | 'next' | 'today') => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const DayMobile = ({
  date,
  slots,
  onEventClick,
  onCreateOpening,
  onNavigate,
}: DayMobileProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [showChip, setShowChip] = useState(false);
  const [chipPosition, setChipPosition] = useState({ top: 0, left: 0 });

  const { scrollToNow } = useTimelineScroll({
    date,
    containerRef: scrollContainerRef,
    enabled: true,
  });

  const {
    selection,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    clearSelection,
    updateSelection,
  } = useTimelineGestures(5);

  // Show chip when selection is made
  useEffect(() => {
    if (selection) {
      setShowChip(true);
      // Position chip near the selection
      const top = ((selection.startHour * 60 + selection.startMinute) / (24 * 60)) * (24 * 60);
      setChipPosition({ top, left: 80 });
    } else {
      setShowChip(false);
    }
  }, [selection]);

  const handleCreateFromSelection = () => {
    if (!selection) return;

    const startTime = `${selection.startHour.toString().padStart(2, '0')}:${selection.startMinute.toString().padStart(2, '0')}`;
    const endTime = `${selection.endHour.toString().padStart(2, '0')}:${selection.endMinute.toString().padStart(2, '0')}`;

    onCreateOpening({ date, startTime, endTime });
    clearSelection();
    setShowChip(false);
  };

  const handleTimeChange = (
    start: { hour: number; minute: number },
    end: { hour: number; minute: number }
  ) => {
    updateSelection({
      startHour: start.hour,
      startMinute: start.minute,
      endHour: end.hour,
      endMinute: end.minute,
    });
  };

  const handleCloseChip = () => {
    clearSelection();
    setShowChip(false);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Mobile Header */}
      <div className="sticky top-0 z-40 bg-card border-b border-border shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Back button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onNavigate('prev')}
            className="h-9 w-9"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          {/* Center: Date */}
          <div className="flex flex-col items-center">
            <div className="text-xs text-muted-foreground">
              {format(date, 'EEEE')}
            </div>
            <div className="text-sm font-semibold">
              {format(date, 'MMM d, yyyy')}
            </div>
          </div>

          {/* Right: Today + Add buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onNavigate('today');
                setTimeout(() => scrollToNow(), 100);
              }}
              className="h-9 px-3 text-xs"
            >
              Today
            </Button>
            <Button
              size="icon"
              onClick={() => onCreateOpening({
                date,
                startTime: format(new Date(), 'HH:mm'),
                endTime: format(new Date(Date.now() + 30 * 60000), 'HH:mm'),
              })}
              className="h-9 w-9"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Timeline Container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden relative"
      >
        <div className="flex">
          {/* Sticky Time Column */}
          <div className="sticky left-0 z-30 bg-background border-r border-border">
            <div className="w-14">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="relative flex items-start justify-end pr-2 pt-1"
                  style={{ height: '60px' }}
                >
                  <span className="text-[10px] font-medium text-muted-foreground leading-none">
                    {format(new Date().setHours(hour, 0), hour === 0 || hour === 12 ? 'h a' : 'h')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline Grid & Events */}
          <div
            ref={timelineRef}
            className="flex-1 relative"
            onTouchStart={(e) => handleTouchStart(e, timelineRef)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Grid */}
            <TimelineGrid date={date} />

            {/* Openings */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="relative h-full pointer-events-auto">
                {slots.map((slot) => {
                  const start = new Date(slot.startTime);
                  const end = new Date(slot.endTime);
                  
                  return (
                    <OpeningBlock
                      key={slot.id}
                      startHour={start.getHours()}
                      startMinute={start.getMinutes()}
                      endHour={end.getHours()}
                      endMinute={end.getMinutes()}
                      title={slot.appointmentName}
                      status={slot.status}
                      onClick={() => onEventClick(slot)}
                    />
                  );
                })}

                {/* Selection Preview */}
                {selection && (
                  <div
                    className="absolute border-2 border-primary bg-primary/10 rounded-md pointer-events-none"
                    style={{
                      top: `${((selection.startHour * 60 + selection.startMinute) / 60) * 60}px`,
                      height: `${((selection.endHour * 60 + selection.endMinute - selection.startHour * 60 - selection.startMinute) / 60) * 60}px`,
                      left: 0,
                      right: 0,
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Opening Chip */}
        {showChip && selection && (
          <OpeningChip
            startHour={selection.startHour}
            startMinute={selection.startMinute}
            endHour={selection.endHour}
            endMinute={selection.endMinute}
            position={chipPosition}
            onEdit={handleCreateFromSelection}
            onDelete={handleCloseChip}
            onTimeChange={handleTimeChange}
            onClose={handleCloseChip}
            isNewSelection
          />
        )}
      </div>
    </div>
  );
};
