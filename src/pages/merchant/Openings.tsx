import { useState } from 'react';
import { addDays, subDays, startOfDay } from 'date-fns';
import MerchantLayout from '@/components/merchant/MerchantLayout';
import { OpeningsHeader } from '@/components/merchant/openings/OpeningsHeader';
import { OpeningsCalendar } from '@/components/merchant/openings/OpeningsCalendar';
import { useOpenings } from '@/hooks/useOpenings';
import { useStaff } from '@/hooks/useStaff';
import { useWorkingHours } from '@/hooks/useWorkingHours';
import { toast } from '@/hooks/use-toast';
import { Opening } from '@/types/openings';

const Openings = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<'day' | 'week' | 'month'>('day');

  // Calculate date range for fetching openings
  const startDate = startOfDay(currentDate);
  const endDate = addDays(startDate, 1);

  // Fetch data
  const { openings, loading: openingsLoading } = useOpenings(startDate, endDate);
  const { primaryStaff, loading: staffLoading } = useStaff();
  const { workingHours, loading: hoursLoading } = useWorkingHours();

  const handlePreviousDay = () => {
    setCurrentDate(prev => subDays(prev, 1));
  };

  const handleNextDay = () => {
    setCurrentDate(prev => addDays(prev, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleAddOpening = () => {
    toast({
      title: "Coming soon",
      description: "Opening modal will be available in Phase 3",
    });
  };

  const handleTimeSlotClick = (time: Date) => {
    toast({
      title: "Coming soon",
      description: `Opening modal will open for ${time.toLocaleTimeString()}`,
    });
  };

  const handleOpeningClick = (opening: Opening) => {
    toast({
      title: "Opening selected",
      description: `Edit modal coming in Phase 3 for: ${opening.appointment_name || 'Opening'}`,
    });
  };

  const handleViewChange = (view: 'day' | 'week' | 'month') => {
    setCurrentView(view);
  };

  const isLoading = openingsLoading || staffLoading || hoursLoading;

  return (
    <MerchantLayout>
      <div className="space-y-6">
        <OpeningsHeader
          currentDate={currentDate}
          onPreviousDay={handlePreviousDay}
          onNextDay={handleNextDay}
          onToday={handleToday}
          onAddOpening={handleAddOpening}
          currentView={currentView}
          onViewChange={handleViewChange}
        />

        {isLoading ? (
          <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
            <div className="text-center text-muted-foreground">
              Loading openings...
            </div>
          </div>
        ) : (
          <>
            <OpeningsCalendar
              currentDate={currentDate}
              currentView={currentView}
              openings={openings}
              workingHours={workingHours}
              onTimeSlotClick={handleTimeSlotClick}
              onOpeningClick={handleOpeningClick}
            />

            {/* Debug Info */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground space-y-2">
              <p className="font-semibold">Phase 2 Debug Info:</p>
              <p>• Openings loaded: {openings.length}</p>
              <p>• Primary staff: {primaryStaff?.name || 'None'}</p>
              <p>• Working hours configured: {Object.keys(workingHours).length} days</p>
              <p>• Current view: {currentView}</p>
              <p>• Click any time slot or opening card to see interaction</p>
            </div>
          </>
        )}
      </div>
    </MerchantLayout>
  );
};

export default Openings;
