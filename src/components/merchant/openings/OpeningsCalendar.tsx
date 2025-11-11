import { Opening, WorkingHours } from '@/types/openings';
import { DayView } from './DayView';
import { WeekView } from './WeekView';
// import { MonthView } from './MonthView'; // ARCHIVED: Month view hidden - see MonthView.ARCHIVED.tsx
import { AgendaView } from './AgendaView';

interface OpeningsCalendarProps {
  currentDate: Date;
  currentView: 'day' | 'week' | 'agenda';
  openings: Opening[];
  workingHours: WorkingHours;
  onTimeSlotClick: (time: Date, duration?: number) => void;
  onOpeningClick: (opening: Opening) => void;
  onViewChange?: (view: 'day' | 'week' | 'agenda') => void;
  onDateChange?: (date: Date) => void;
  highlightedOpeningId?: string | null;
  profileDefaultDuration?: number;
  onPreviousDay?: () => void;
  onNextDay?: () => void;
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
  onPreviousDay,
  onNextDay,
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
        onPreviousDay={onPreviousDay || (() => {})}
        onNextDay={onNextDay || (() => {})}
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
        onPreviousWeek={onPreviousDay}
        onNextWeek={onNextDay}
      />
    );
  }

  if (currentView === 'agenda') {
    return (
      <AgendaView
        currentDate={currentDate}
        openings={openings}
        onOpeningClick={onOpeningClick}
        highlightedOpeningId={highlightedOpeningId}
        onPreviousDay={onPreviousDay || (() => {})}
        onNextDay={onNextDay || (() => {})}
      />
    );
  }

  return null;
};
