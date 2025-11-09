import { useState, useMemo } from 'react';
import { addDays, subDays, startOfDay, startOfWeek, endOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
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
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const Openings = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<'day' | 'week' | 'month'>('day');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOpening, setSelectedOpening] = useState<Opening | null>(null);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [highlightedOpeningId, setHighlightedOpeningId] = useState<string | null>(null);

  // Calculate date range for fetching openings based on current view
  const dateRange = useMemo(() => {
    if (currentView === 'day') {
      const startDate = startOfDay(currentDate);
      const endDate = addDays(startDate, 1);
      return { startDate, endDate };
    } else if (currentView === 'week') {
      const startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
      const endDate = endOfWeek(currentDate, { weekStartsOn: 0 });
      return { startDate, endDate: addDays(endDate, 1) };
    } else {
      // month
      const startDate = startOfMonth(currentDate);
      const endDate = endOfMonth(currentDate);
      return { startDate, endDate: addDays(endDate, 1) };
    }
  }, [currentDate, currentView]);

  // Fetch data
  const { openings, loading: openingsLoading, createOpening, updateOpening, deleteOpening, checkConflict, refetch } = useOpenings(dateRange.startDate, dateRange.endDate);
  const { primaryStaff, loading: staffLoading } = useStaff();
  const { workingHours, loading: hoursLoading } = useWorkingHours();
  const { profile } = useMerchantProfile();

  const handlePreviousDay = () => {
    if (currentView === 'day') {
      setCurrentDate(prev => subDays(prev, 1));
    } else if (currentView === 'week') {
      setCurrentDate(prev => subWeeks(prev, 1));
    } else {
      setCurrentDate(prev => subMonths(prev, 1));
    }
  };

  const handleNextDay = () => {
    if (currentView === 'day') {
      setCurrentDate(prev => addDays(prev, 1));
    } else if (currentView === 'week') {
      setCurrentDate(prev => addWeeks(prev, 1));
    } else {
      setCurrentDate(prev => addMonths(prev, 1));
    }
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
    try {
      if (selectedOpening) {
        // Update existing opening
        await updateOpening(selectedOpening.id, {
          start_time: data.start_time,
          end_time: data.end_time,
          duration_minutes: data.duration_minutes,
          appointment_name: data.appointment_name,
        });
        
        toast({
          title: "Opening updated",
          description: "Your opening has been successfully updated.",
        });
      } else {
        // Create new opening
        const newOpening = await createOpening({
          start_time: data.start_time,
          end_time: data.end_time,
          duration_minutes: data.duration_minutes,
          appointment_name: data.appointment_name,
          staff_id: primaryStaff?.id,
        });

        if (newOpening) {
          // Set highlight for brief animation
          setHighlightedOpeningId(newOpening.id);
          setTimeout(() => setHighlightedOpeningId(null), 2000);

          // Trigger SMS notifications for matching consumers
          if (user) {
            try {
              const { data: notifyData, error: notifyError } = await supabase.functions.invoke('notify-consumers', {
                body: {
                  slotId: newOpening.id,
                  merchantId: user.id,
                }
              });

              if (!notifyError && notifyData?.notified > 0) {
                toast({
                  title: "Opening created!",
                  description: `${notifyData.notified} consumer${notifyData.notified > 1 ? 's' : ''} notified`,
                });
              } else {
                toast({
                  title: "Opening created!",
                  description: "Your opening is now available for booking.",
                });
              }
            } catch (error) {
              console.error('Error sending notifications:', error);
              toast({
                title: "Opening created!",
                description: "Your opening is now available for booking.",
              });
            }
          }
        }
      }

      setModalOpen(false);
      setSelectedOpening(null);
      setDefaultDuration(undefined);
      
      // Force immediate calendar refresh
      await refetch();
      
    } catch (error) {
      console.error('Error saving opening:', error);
      toast({
        title: "Error",
        description: "Failed to save opening. Please try again.",
        variant: "destructive",
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
      <div className="space-y-6 relative pb-2">
        <OpeningsHeader
          currentDate={currentDate}
          onDateChange={setCurrentDate}
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
              onViewChange={handleViewChange}
              onDateChange={setCurrentDate}
              highlightedOpeningId={highlightedOpeningId}
              profileDefaultDuration={profile?.default_opening_duration || undefined}
            />
          </>
         )}
        
        {/* Floating Add Opening Button */}
        <Button
          onClick={handleAddOpening}
          size="lg"
          className="fixed bottom-20 sm:bottom-16 md:bottom-8 lg:bottom-6 right-4 sm:right-6 z-50 shadow-2xl h-12 lg:h-14 px-4 lg:px-6 flex items-center justify-center"
        >
          <Plus className="mr-2 h-5 w-5" />
          Add Opening
        </Button>
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
        savedDurations={profile?.saved_durations || []}
        profileDefaultDuration={profile?.default_opening_duration || undefined}
      />
    </MerchantLayout>
  );
};

export default Openings;
