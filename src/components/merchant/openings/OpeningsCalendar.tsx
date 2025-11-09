import { Opening, WorkingHours } from '@/types/openings';
import { DayView } from './DayView';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';

interface OpeningsCalendarProps {
  currentDate: Date;
  currentView: 'day' | 'week' | 'month';
  openings: Opening[];
  workingHours: WorkingHours;
  onTimeSlotClick: (time: Date, duration?: number) => void;
  onOpeningClick: (opening: Opening) => void;
  onViewChange?: (view: 'day' | 'week' | 'month') => void;
  onDateChange?: (date: Date) => void;
  highlightedOpeningId?: string | null;
  profileDefaultDuration?: number;
}

export const OpeningsCalendar = ({
  currentDate,
  currentView,
  openings,
  workingHours,
  onTimeSlotClick,
  onOpeningClick,
  onViewChange,
  onDateChange,
  highlightedOpeningId,
  profileDefaultDuration,
}: OpeningsCalendarProps) => {
  if (currentView === 'day') {
    return (
      <DayView
        currentDate={currentDate}
        openings={openings}
        workingHours={workingHours}
        onTimeSlotClick={onTimeSlotClick}
        onOpeningClick={onOpeningClick}
        highlightedOpeningId={highlightedOpeningId}
        profileDefaultDuration={profileDefaultDuration}
      />
    );
  }

  if (currentView === 'week') {
    return (
      <WeekView
        currentDate={currentDate}
        openings={openings}
        workingHours={workingHours}
        onTimeSlotClick={onTimeSlotClick}
        onOpeningClick={onOpeningClick}
        highlightedOpeningId={highlightedOpeningId}
        profileDefaultDuration={profileDefaultDuration}
      />
    );
  }

  if (currentView === 'month') {
    return (
      <MonthView
        currentDate={currentDate}
        openings={openings}
        onDateClick={(date) => {
          onDateChange?.(date);
          onViewChange?.('day');
        }}
      />
    );
  }

  return null;
};
