import { useState, useMemo, useEffect, useCallback } from 'react';
import { addDays, subDays, startOfDay, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { OpeningsHeader } from '@/components/merchant/openings/OpeningsHeader';
import { OpeningsCalendar } from '@/components/merchant/openings/OpeningsCalendar';
import { OpeningModal, OpeningFormData } from '@/components/merchant/openings/OpeningModal';
import { BookedOpeningModal } from '@/components/merchant/openings/BookedOpeningModal';
import { useOpenings } from '@/hooks/useOpenings';
import { useStaff } from '@/hooks/useStaff';
import { useWorkingHours } from '@/hooks/useWorkingHours';
import { useMerchantProfile } from '@/hooks/useMerchantProfile';
import { useBookingSync } from '@/hooks/useBookingSync';
import { toast } from '@/hooks/use-toast';
import { Opening } from '@/types/openings';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CheckCircle2, XCircle, User, Phone } from 'lucide-react';
import { AddOpeningCTA } from '@/components/merchant/openings/AddOpeningCTA';
import { FirstOpeningCelebration, useFirstOpeningCelebration } from '@/components/billing';
import { useEntitlements } from '@/hooks/useEntitlements';

const Openings = () => {
  const { user } = useAuth();
  const entitlements = useEntitlements();
  
  // Enable real-time calendar sync for bookings
  useBookingSync();
  
  // First opening celebration hook
  const { isOpen: celebrationOpen, showCelebration, dismissCelebration } = useFirstOpeningCelebration();
  
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<'day' | 'week' | 'agenda'>('agenda');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOpening, setSelectedOpening] = useState<Opening | null>(null);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [highlightedOpeningId, setHighlightedOpeningId] = useState<string | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvingOpening, setApprovingOpening] = useState<Opening | null>(null);
  const [bookingActionLoading, setBookingActionLoading] = useState(false);

  const isReadOnlyAccess = !entitlements.loading
    && !!entitlements.subscriptionData.subscription
    && entitlements.trialExpired
    && !entitlements.isSubscribed;

  // Calculate date range for fetching openings based on current view
  const dateRange = useMemo(() => {
    if (currentView === 'agenda') {
      // For agenda view, fetch the active day so historical navigation works
      const startDate = startOfDay(currentDate);
      const endDate = addDays(startDate, 1);
      return { startDate, endDate };
    } else if (currentView === 'day') {
      const startDate = startOfDay(currentDate);
      const endDate = addDays(startDate, 1);
      return { startDate, endDate };
    } else {
      // week
      const startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
      const endDate = endOfWeek(currentDate, { weekStartsOn: 0 });
      return { startDate, endDate: addDays(endDate, 1) };
    }
  }, [currentDate, currentView]);

  // Fetch data
  const { openings, loading: openingsLoading, createOpening, updateOpening, deleteOpening, checkConflict, refetch } = useOpenings(dateRange.startDate, dateRange.endDate);
  const { primaryStaff, loading: staffLoading } = useStaff();
  const { workingHours, loading: hoursLoading } = useWorkingHours();
  const { profile } = useMerchantProfile();

  const handlePreviousDay = () => {
    if (currentView === 'day' || currentView === 'agenda') {
      setCurrentDate(prev => subDays(prev, 1));
    } else if (currentView === 'week') {
      setCurrentDate(prev => subWeeks(prev, 1));
    }
  };

  const handleNextDay = () => {
    if (currentView === 'day' || currentView === 'agenda') {
      setCurrentDate(prev => addDays(prev, 1));
    } else if (currentView === 'week') {
      setCurrentDate(prev => addWeeks(prev, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleAddOpening = () => {
    if (isReadOnlyAccess) return;
    setSelectedOpening(null);
    setSelectedTime(null);
    setModalOpen(true);
  };

  const [defaultDuration, setDefaultDuration] = useState<number | undefined>(undefined);

  const handleTimeSlotClick = (time: Date, duration?: number) => {
    if (isReadOnlyAccess) return;
    setSelectedOpening(null);
    setSelectedTime(time);
    setDefaultDuration(duration);
    setModalOpen(true);
  };

  const handleOpeningClick = (opening: Opening) => {
    if (isReadOnlyAccess) return;
    setSelectedOpening(opening);
    setSelectedTime(null);
    setModalOpen(true);
  };

  const handleViewChange = (view: 'day' | 'week' | 'agenda') => {
    setCurrentView(view);
  };

  // Helper function to safely notify consumers - never throws, always returns status
  const notifyConsumersSafely = async (slotId: string, merchantId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('notify-consumers', {
        body: { slotId, merchantId }
      });
      
      // Handle Supabase client errors (network, auth, etc.)
      if (error) {
        console.error('[Notifications] Supabase client error:', error);
        return { success: false, notified: 0, error: error.message || String(error) };
      }
      
      // Handle function-level errors (function returned error response)
      if (data && typeof data === 'object' && 'success' in data && !data.success) {
        console.error('[Notifications] Function returned error:', data.error);
        return { success: false, notified: 0, error: data.error || 'Unknown error' };
      }
      
      // Success case
      const notified = (data && typeof data === 'object' && 'notified' in data) ? (data.notified || 0) : 0;
      return { success: true, notified };
    } catch (err) {
      console.error('[Notifications] Exception:', err);
      return { success: false, notified: 0, error: err instanceof Error ? err.message : String(err) };
    }
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
          notes: data.notes || null,
        });
        
        toast({
          title: "Opening updated",
          description: "Your opening has been successfully updated.",
        });
      } else {
        // Create new opening - this is the critical operation
        const newOpening = await createOpening({
          start_time: data.start_time,
          end_time: data.end_time,
          duration_minutes: data.duration_minutes,
          appointment_name: data.appointment_name,
          notes: data.notes,
          staff_id: primaryStaff?.id,
        });

        if (newOpening) {
          // Set highlight for brief animation
          setHighlightedOpeningId(newOpening.id);
          setTimeout(() => setHighlightedOpeningId(null), 2000);

          // Opening created successfully - now handle notifications separately
          // Notification failures should NOT block the success flow
          const merchantId = user?.id || newOpening.merchant_id;
          if (data.publish_now && merchantId) {
            const notificationResult = await notifyConsumersSafely(newOpening.id, merchantId);
            
            if (notificationResult.success && notificationResult.notified > 0) {
              toast({
                title: "Opening published!",
                description: `${notificationResult.notified} subscriber${notificationResult.notified > 1 ? 's' : ''} notified`,
              });
            } else if (notificationResult.success) {
              toast({
                title: "Opening published!",
                description: "Your opening is now available for booking.",
              });
            } else {
              // Notification failed but opening was saved - show warning, not error
              console.warn('[Notifications] Failed to send notifications:', notificationResult.error);
              toast({
                title: "Opening published!",
                description: "Your opening is now available for booking. (Notifications may be delayed)",
              });
            }
          } else if (!data.publish_now) {
            toast({
              title: "Opening saved",
              description: "Opening saved as draft. Publish later to notify subscribers.",
            });
          } else {
            // Fallback: opening created but no publish flag
            toast({
              title: "Opening created",
              description: "New opening has been added to your calendar",
            });
          }
        }
      }

      setModalOpen(false);
      setSelectedOpening(null);
      setDefaultDuration(undefined);
      
      // Force immediate calendar refresh
      await refetch();
      
    } catch (error) {
      // Only show error toast for actual opening save/update failures
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

  // Handle approval query parameter
  useEffect(() => {
    const approveSlotId = searchParams.get('approve');
    
    if (approveSlotId && openings.length > 0) {
      const slotToApprove = openings.find(s => s.id === approveSlotId);
      if (slotToApprove && slotToApprove.status === 'pending_confirmation') {
        setApprovingOpening(slotToApprove);
        setApprovalDialogOpen(true);
        // Clear the query param
        searchParams.delete('approve');
        setSearchParams(searchParams);
      }
    }
  }, [searchParams, openings, setSearchParams]);

  // Check if this is the merchant's first booking
  const checkFirstBookingAndCelebrate = useCallback(async () => {
    if (!user) return;
    
    try {
      // Count total booked slots for this merchant
      const { count, error } = await supabase
        .from('slots')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', user.id)
        .eq('status', 'booked');
      
      if (error) throw error;
      
      // If this is the first booking (count is 1), show celebration
      if (count === 1) {
        showCelebration();
      }
    } catch (error) {
      console.error('Error checking first booking:', error);
    }
  }, [user, showCelebration]);

  const handleApproveBooking = async () => {
    if (!approvingOpening) return;

    await updateBookingStatus(approvingOpening, 'booked');
    setApprovalDialogOpen(false);
    setApprovingOpening(null);
  };

  const handleRejectBooking = async () => {
    if (!approvingOpening) return;
    await updateBookingStatus(approvingOpening, 'open');
    setApprovalDialogOpen(false);
    setApprovingOpening(null);
  };

  const isLoading = openingsLoading || staffLoading || hoursLoading;
  const isReadOnlyOpening = selectedOpening?.status === 'booked' || selectedOpening?.status === 'pending_confirmation';

  const updateBookingStatus = useCallback(async (opening: Opening, status: 'booked' | 'open') => {
    try {
      setBookingActionLoading(true);
      const updatePayload: Record<string, string | null> = { status };

      if (status === 'open') {
        updatePayload.booked_by_consumer_id = null;
        updatePayload.booked_by_name = null;
        updatePayload.consumer_phone = null;
      }

      const { error } = await supabase
        .from('slots')
        .update(updatePayload)
        .eq('id', opening.id);

      if (error) throw error;

      toast({
        title: status === 'booked' ? "Booking approved" : "Booking rejected",
        description: status === 'booked'
          ? "The customer has been notified."
          : "The slot is now available again.",
      });

      if (status === 'booked') {
        checkFirstBookingAndCelebrate();
      }

      await refetch();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update booking";
      console.error('Error updating booking:', error);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setBookingActionLoading(false);
    }
  }, [checkFirstBookingAndCelebrate, refetch]);

  const handleModalApprove = async () => {
    if (!selectedOpening) return;
    await updateBookingStatus(selectedOpening, 'booked');
    setModalOpen(false);
    setSelectedOpening(null);
  };

  const handleModalReject = async () => {
    if (!selectedOpening) return;
    await updateBookingStatus(selectedOpening, 'open');
    setModalOpen(false);
    setSelectedOpening(null);
  };

  return (
    <>
      <div className="relative">
        {isReadOnlyAccess && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/70 backdrop-blur-[2px] animate-in fade-in-0 duration-200">
            <div className="max-w-md rounded-lg border bg-card px-6 py-4 text-center shadow-sm">
              <p className="text-sm text-muted-foreground">
                Subscription required to manage openings.
              </p>
            </div>
          </div>
        )}
        <div className={isReadOnlyAccess ? 'pointer-events-none opacity-60' : ''}>
          <OpeningsHeader
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            onPreviousDay={handlePreviousDay}
            onNextDay={handleNextDay}
            onToday={handleToday}
            onAddOpening={handleAddOpening}
            disableAddOpening={isReadOnlyAccess}
            currentView={currentView}
            onViewChange={handleViewChange}
          />

          {/* Calendar content with proper spacing */}
          <div className="mt-3 md:mt-4 px-4 md:px-6 pb-2">
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
                  onPreviousDay={handlePreviousDay}
                  onNextDay={handleNextDay}
                />
              </>
            )}
          </div>
          
          {/* Mobile FAB - only shown on mobile */}
          <div className="md:hidden">
            <AddOpeningCTA onClick={handleAddOpening} variant="fab" disabled={isReadOnlyAccess} />
          </div>
        </div>
      </div>

      {/* Opening Modal */}
      <OpeningModal
        open={modalOpen && !isReadOnlyOpening}
        onClose={() => {
          setModalOpen(false);
          setDefaultDuration(undefined);
        }}
        onSave={handleSaveOpening}
        onDelete={selectedOpening && !isReadOnlyOpening ? handleDeleteOpening : undefined}
        opening={isReadOnlyOpening ? null : selectedOpening}
        defaultDate={currentDate}
        defaultTime={selectedTime || undefined}
        defaultDuration={defaultDuration}
        workingHours={workingHours}
        primaryStaff={primaryStaff}
        checkConflict={handleCheckConflict}
        
        savedDurations={profile?.saved_durations || []}
        profileDefaultDuration={profile?.default_opening_duration || undefined}
      />

      <BookedOpeningModal
        open={modalOpen && isReadOnlyOpening}
        onClose={() => {
          setModalOpen(false);
          setDefaultDuration(undefined);
        }}
        opening={isReadOnlyOpening ? selectedOpening : null}
        primaryStaff={primaryStaff}
        onApprove={selectedOpening?.status === 'pending_confirmation' ? handleModalApprove : undefined}
        onReject={selectedOpening?.status === 'pending_confirmation' ? handleModalReject : undefined}
        actionLoading={bookingActionLoading}
      />

      {/* Approval Dialog */}
      <AlertDialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Booking Request</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>A customer wants to book this opening:</p>
                {approvingOpening && (
                  <div className="space-y-1 text-foreground">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span className="font-medium">{approvingOpening.booked_by_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{approvingOpening.consumer_phone}</span>
                    </div>
                  </div>
                )}
                <p className="text-muted-foreground">Would you like to approve this booking?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleRejectBooking} disabled={bookingActionLoading}>
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleApproveBooking} disabled={bookingActionLoading}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* First Opening Celebration Modal */}
      <FirstOpeningCelebration 
        isOpen={celebrationOpen}
        onClose={dismissCelebration}
      />
    </>
  );
};

export default Openings;
