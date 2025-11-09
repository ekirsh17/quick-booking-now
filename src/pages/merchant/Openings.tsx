import { useState, useMemo } from 'react';
import { addDays, subDays, startOfDay } from 'date-fns';
import MerchantLayout from '@/components/merchant/MerchantLayout';
import { OpeningsHeader } from '@/components/merchant/openings/OpeningsHeader';
import { OpeningsCalendar } from '@/components/merchant/openings/OpeningsCalendar';
import { OpeningModal, OpeningFormData } from '@/components/merchant/openings/OpeningModal';
import { useOpenings } from '@/hooks/useOpenings';
import { useStaff } from '@/hooks/useStaff';
import { useWorkingHours } from '@/hooks/useWorkingHours';
import { useMerchantProfile } from '@/hooks/useMerchantProfile';
import { toast } from '@/hooks/use-toast';
import { Opening } from '@/types/openings';
import { useAuth } from '@/hooks/useAuth';

const Openings = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<'day' | 'week' | 'month'>('day');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOpening, setSelectedOpening] = useState<Opening | null>(null);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);

  // Calculate date range for fetching openings - memoized to prevent re-renders
  const dateRange = useMemo(() => {
    const startDate = startOfDay(currentDate);
    const endDate = addDays(startDate, 1);
    return { startDate, endDate };
  }, [currentDate]);

  // Fetch data
  const { openings, loading: openingsLoading, createOpening, updateOpening, deleteOpening, checkConflict } = useOpenings(dateRange.startDate, dateRange.endDate);
  const { primaryStaff, loading: staffLoading } = useStaff();
  const { workingHours, loading: hoursLoading } = useWorkingHours();
  const { profile } = useMerchantProfile();

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
    setSelectedOpening(null);
    setSelectedTime(null);
    setModalOpen(true);
  };

  const [defaultDuration, setDefaultDuration] = useState<number | undefined>(undefined);

  const handleTimeSlotClick = (time: Date, duration?: number) => {
    setSelectedOpening(null);
    setSelectedTime(time);
    setDefaultDuration(duration);
    setModalOpen(true);
  };

  const handleOpeningClick = (opening: Opening) => {
    setSelectedOpening(opening);
    setSelectedTime(null);
    setModalOpen(true);
  };

  const handleViewChange = (view: 'day' | 'week' | 'month') => {
    setCurrentView(view);
  };

  const handleSaveOpening = async (data: OpeningFormData) => {
    if (selectedOpening) {
      // Update existing opening
      await updateOpening(selectedOpening.id, {
        start_time: data.start_time,
        end_time: data.end_time,
        duration_minutes: data.duration_minutes,
        appointment_name: data.appointment_name,
      });
    } else {
      // Create new opening
      await createOpening({
        start_time: data.start_time,
        end_time: data.end_time,
        duration_minutes: data.duration_minutes,
        appointment_name: data.appointment_name,
        staff_id: primaryStaff?.id,
      });
    }
  };

  const handleDeleteOpening = async () => {
    if (selectedOpening) {
      await deleteOpening(selectedOpening.id);
    }
  };

  const handleCheckConflict = async (startTime: string, endTime: string, openingId?: string) => {
    if (!user) return false;
    
    return await checkConflict({
      merchant_id: user.id,
      staff_id: primaryStaff?.id || null,
      start_time: startTime,
      end_time: endTime,
      slot_id: openingId,
    });
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
          </>
        )}
      </div>

      {/* Opening Modal */}
      <OpeningModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setDefaultDuration(undefined);
        }}
        onSave={handleSaveOpening}
        onDelete={selectedOpening ? handleDeleteOpening : undefined}
        opening={selectedOpening}
        defaultDate={currentDate}
        defaultTime={selectedTime || undefined}
        defaultDuration={defaultDuration}
        workingHours={workingHours}
        primaryStaff={primaryStaff}
        checkConflict={handleCheckConflict}
        savedAppointmentNames={profile?.saved_appointment_names || []}
      />
    </MerchantLayout>
  );
};

export default Openings;
