import { Opening, WorkingHours } from '@/types/openings';
import { DayView } from './DayView';

interface OpeningsCalendarProps {
  currentDate: Date;
  currentView: 'day' | 'week' | 'month';
  openings: Opening[];
  workingHours: WorkingHours;
  onTimeSlotClick: (time: Date, duration?: number) => void;
  onOpeningClick: (opening: Opening) => void;
}

export const OpeningsCalendar = ({
  currentDate,
  currentView,
  openings,
  workingHours,
  onTimeSlotClick,
  onOpeningClick,
}: OpeningsCalendarProps) => {
  if (currentView === 'day') {
    return (
      <DayView
        currentDate={currentDate}
        openings={openings}
        workingHours={workingHours}
        onTimeSlotClick={onTimeSlotClick}
        onOpeningClick={onOpeningClick}
      />
    );
  }

  // Week and Month views coming in Phase 4
  return (
    <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="text-center space-y-2">
        <p className="text-lg font-medium text-muted-foreground">
          {currentView === 'week' ? 'Week' : 'Month'} view coming in Phase 4
        </p>
        <p className="text-sm text-muted-foreground">
          Selected date: {currentDate.toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};
