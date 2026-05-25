import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { addDays, subDays, startOfDay, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { Link, useSearchParams } from 'react-router-dom';
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
import { Button } from '@/components/ui/button';
import { useActiveLocation } from '@/hooks/useActiveLocation';
import { useActivationContext } from '@/contexts/ActivationContext';
import { useSetupSectionFocus } from '@/lib/setupSectionFocus';

const Openings = () => {
  useSetupSectionFocus(undefined, { scrollDelayMs: 400 });
  const { user } = useAuth();
  const entitlements = useEntitlements();
  
  // Enable real-time calendar sync for bookings
  useBookingSync();
  
  // First opening celebration hook
  const { isOpen: celebrationOpen, showCelebration, dismissCelebration } = useFirstOpeningCelebration();
  
  const [searchParams, setSearchParams] = useSearchParams();
  const createActionHandledRef = useRef(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<'day' | 'week' | 'agenda'>('agenda');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOpening, setSelectedOpening] = useState<Opening | null>(null);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [highlightedOpeningId, setHighlightedOpeningId] = useState<string | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvingOpening, setApprovingOpening] = useState<Opening | null>(null);
  const [bookingActionLoading, setBookingActionLoading] = useState(false);

  const isCanceledLocked = !entitlements.loading
    && entitlements.subscriptionData.isCanceled
    && !entitlements.subscriptionData.isCanceledTrial;
  const isReadOnlyAccess = !entitlements.loading
    && !!entitlements.subscriptionData.subscription
    && entitlements.trialExpired
    && !entitlements.isSubscribed
    && !isCanceledLocked;
  const isActionBlocked = isReadOnlyAccess || isCanceledLocked;

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

  const { locationId } = useActiveLocation();
  const { refresh: refreshActivationSetup, expandSetupChecklist } = useActivationContext();
  // Fetch data
  const { openings, loading: openingsLoading, createOpening, updateOpening, deleteOpening, checkConflict, refetch } = useOpenings(dateRange.startDate, dateRange.endDate, locationId);
  const { staff, primaryStaff, loading: staffLoading } = useStaff(locationId);
  const { workingHours, loading: hoursLoading } = useWorkingHours();
  const { profile } = useMerchantProfile();
  const [staffFilter, setStaffFilter] = useState<string>('all');

  useEffect(() => {
    const saved = sessionStorage.getItem('openings-staff-filter');
    if (saved) {
      setStaffFilter(saved);
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem('openings-staff-filter', staffFilter);
  }, [staffFilter]);

  useEffect(() => {
    const action = searchParams.get('action');
    if (action !== 'create') {
      createActionHandledRef.current = false;
      return;
    }

    if (createActionHandledRef.current) return;

    const clearCreateAction = () => {
      const next = new URLSearchParams(searchParams);
      next.delete('action');
      setSearchParams(next, { replace: true });
    };

    if (isActionBlocked) {
      createActionHandledRef.current = true;
      clearCreateAction();
      toast({
        title: 'Subscription required',
        description: 'Upgrade or renew your plan to post openings.',
        variant: 'destructive',
      });
      return;
    }

    createActionHandledRef.current = true;
    setSelectedOpening(null);
    setSelectedTime(null);
    setModalOpen(true);
    clearCreateAction();
  }, [isActionBlocked, searchParams, setSearchParams]);

  useEffect(() => {
    if (staffFilter === 'all') return;
    if (!staff.some((member) => member.id === staffFilter)) {
      setStaffFilter('all');
    }
  }, [staff, staffFilter]);

  const staffLookup = useMemo(() => new Map(staff.map((member) => [member.id, member.name])), [staff]);
  const getStaffName = useCallback(
    (staffId: string | null) => {
      if (!staffId) {
        return staff.length > 1 ? 'Any staff' : null;
      }
      return staffLookup.get(staffId) ?? null;
    },
    [staff, staffLookup]
  );

  const filteredOpenings = useMemo(() => {
    if (staffFilter === 'all') return openings;
    return openings.filter((opening) => opening.staff_id === staffFilter);
  }, [openings, staffFilter]);

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
    if (isActionBlocked) return;
    setSelectedOpening(null);
    setSelectedTime(null);
    setModalOpen(true);
  };

  const [defaultDuration, setDefaultDuration] = useState<number | undefined>(undefined);

  const handleTimeSlotClick = (time: Date, duration?: number) => {
    if (isActionBlocked) return;
    setSelectedOpening(null);
    setSelectedTime(time);
    setDefaultDuration(duration);
    setModalOpen(true);
  };

  const handleOpeningClick = (opening: Opening) => {
    if (isActionBlocked) return;
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
          staff_id: data.staff_id || null,
        });
        
        toast({
          title: "Opening updated",
          description: "Your opening has been successfully updated",
        });
      } else {
        // Create new opening - this is the critical operation
        const newOpening = await createOpening({
          start_time: data.start_time,
          end_time: data.end_time,
          duration_minutes: data.duration_minutes,
          appointment_name: data.appointment_name,
          notes: data.notes,
          staff_id: data.staff_id || primaryStaff?.id || null,
          location_id: locationId || undefined,
        });

        if (newOpening) {
          await refreshActivationSetup();
          expandSetupChecklist();
          // Set highlight for brief animation
          setHighlightedOpeningId(newOpening.id);
          setTimeout(() => setHighlightedOpeningId(null), 2000);

          // Opening created successfully - handle notifications without blocking UI
          // Notification failures should NOT block the success flow
          const merchantId = user?.id || newOpening.merchant_id;
          if (data.publish_now && merchantId) {
            void notifyConsumersSafely(newOpening.id, merchantId).then((notificationResult) => {
              if (notificationResult.success && notificationResult.notified > 0) {
                toast({
                  title: `Opening Published: ${notificationResult.notified} Notified`,
                });
                return;
              }

              if (notificationResult.success) {
                toast({
                  title: "Opening published",
                });
                return;
              }

              // Notification failed but opening was saved - show warning, not error
              console.warn('[Notifications] Failed to send notifications:', notificationResult.error);
              toast({
                title: "Opening published",
                description: "Your opening is now available for booking. (Notifications may be delayed)",
              });
            });
          } else if (!data.publish_now) {
            toast({
              title: "Opening saved",
              description: "Publish later to notify your waitlist",
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
        description: "Failed to save opening. Please try again",
        variant: "destructive",
      });
    }
  };

  const handleDeleteOpening = async () => {
    if (selectedOpening) {
      await deleteOpening(selectedOpening.id);
      setSelectedOpening(null);
      setModalOpen(false);
      setDefaultDuration(undefined);
      void refetch();
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

  // Handle approval query parameter, including slots outside current view range
  useEffect(() => {
    const approveSlotId = searchParams.get('approve');
    if (!approveSlotId || !user?.id) return;

    let isCancelled = false;

    const clearApproveParam = () => {
      const next = new URLSearchParams(searchParams);
      next.delete('approve');
      setSearchParams(next, { replace: true });
    };

    const loadApprovalSlot = async () => {
      const { data, error } = await supabase
        .from('slots')
        .select('*')
        .eq('id', approveSlotId)
        .eq('merchant_id', user.id)
        .maybeSingle();

      if (isCancelled) return;

      if (error || !data) {
        setApprovingOpening(null);
        setApprovalDialogOpen(false);
        toast({
          title: 'Booking request not found',
          description: 'This request may no longer exist.',
          variant: 'destructive',
        });
        clearApproveParam();
        return;
      }

      const slotToApprove = data as Opening;
      if (slotToApprove.status !== 'pending_confirmation') {
        setApprovingOpening(null);
        setApprovalDialogOpen(false);
        toast({
          title: 'Booking request unavailable',
          description: 'This request was already approved or rejected.',
          variant: 'destructive',
        });
        clearApproveParam();
        return;
      }

      setApprovingOpening(slotToApprove);
      setApprovalDialogOpen(true);
      clearApproveParam();
    };

    void loadApprovalSlot();

    return () => {
      isCancelled = true;
    };
  }, [searchParams, setSearchParams, user?.id, toast]);

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

    const didUpdate = await updateBookingStatus(approvingOpening, 'approve');
    if (didUpdate) {
      setApprovalDialogOpen(false);
      setApprovingOpening(null);
    }
  };

  const handleRejectBooking = async () => {
    if (!approvingOpening) return;
    const didUpdate = await updateBookingStatus(approvingOpening, 'reject');
    if (didUpdate) {
      setApprovalDialogOpen(false);
      setApprovingOpening(null);
    }
  };

  const isLoading = openingsLoading || staffLoading || hoursLoading;
  const isReadOnlyOpening = selectedOpening?.status === 'booked' || selectedOpening?.status === 'pending_confirmation';

  const getFreshAccessToken = useCallback(async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      throw new Error('Could not verify your session. Please sign in again.');
    }

    const currentSession = sessionData.session;
    if (!currentSession) {
      throw new Error('Session expired. Please sign in again and retry.');
    }

    const expiresAtMs = (currentSession.expires_at ?? 0) * 1000;
    const expiresSoon = !expiresAtMs || (expiresAtMs - Date.now()) < 60_000;
    if (!expiresSoon) {
      return currentSession.access_token;
    }

    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshedData.session?.access_token) {
      throw new Error('Session expired. Please sign in again and retry.');
    }

    return refreshedData.session.access_token;
  }, []);

  const callConfirmBooking = useCallback(async ({
    slotId,
    action,
    accessToken,
  }: {
    slotId: string;
    action: 'approve' | 'reject';
    accessToken: string;
  }) => {
    const responseRaw = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confirm-booking`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          slotId,
          action,
        }),
      },
    );

    let responseBody: unknown = null;
    try {
      responseBody = await responseRaw.json();
    } catch {
      responseBody = null;
    }

    return { responseRaw, responseBody };
  }, []);

  const updateBookingStatus = useCallback(async (opening: Opening, action: 'approve' | 'reject') => {
    try {
      setBookingActionLoading(true);
      let accessToken = await getFreshAccessToken();
      let { responseRaw, responseBody } = await callConfirmBooking({
        slotId: opening.id,
        action,
        accessToken,
      });

      // If token raced expiration/restore window, refresh once and retry.
      if (responseRaw.status === 401) {
        accessToken = await getFreshAccessToken();
        const retryResult = await callConfirmBooking({
          slotId: opening.id,
          action,
          accessToken,
        });
        responseRaw = retryResult.responseRaw;
        responseBody = retryResult.responseBody;
      }

      if (!responseRaw.ok) {
        const responseError = responseBody as { error?: string; message?: string } | null;
        throw new Error(
          responseError?.error || responseError?.message || 'Failed to update booking',
        );
      }

      const response = (responseBody ?? {}) as {
        success?: boolean;
        error?: string;
        notificationSent?: boolean;
      };

      if (!response.success) {
        throw new Error(response.error || 'Failed to update booking');
      }

      const notificationSent = response.notificationSent !== false;
      const isApprove = action === 'approve';

      toast({
        title: isApprove ? "Booking approved" : "Booking rejected",
        description: isApprove
          ? (notificationSent
            ? "The customer has been notified."
            : "Booking approved, but customer SMS could not be delivered.")
          : (notificationSent
            ? "The slot is open again and the customer was notified."
            : "Slot reopened, but customer SMS could not be delivered."),
      });

      if (isApprove) {
        checkFirstBookingAndCelebrate();
      }

      await refetch();
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update booking";
      console.error('Error updating booking:', error);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      setBookingActionLoading(false);
    }
  }, [callConfirmBooking, checkFirstBookingAndCelebrate, getFreshAccessToken, refetch]);

  const handleModalApprove = async () => {
    if (!selectedOpening) return;
    const didUpdate = await updateBookingStatus(selectedOpening, 'approve');
    if (didUpdate) {
      setModalOpen(false);
      setSelectedOpening(null);
    }
  };

  const handleModalReject = async () => {
    if (!selectedOpening) return;
    const didUpdate = await updateBookingStatus(selectedOpening, 'reject');
    if (didUpdate) {
      setModalOpen(false);
      setSelectedOpening(null);
    }
  };

  const parsePendingCustomerFromNotes = useCallback((notes?: string | null) => {
    if (!notes) return { name: null as string | null, phone: null as string | null };

    const parts = notes.split('|').map((part) => part.trim()).filter(Boolean);
    let name: string | null = null;
    let phone: string | null = null;

    for (const part of parts) {
      const [rawKey, ...rest] = part.split(':');
      if (rest.length === 0) continue;

      const key = rawKey.trim().toLowerCase();
      const value = rest.join(':').trim();
      if (!value) continue;

      if (key === 'booked_by' || key === 'name' || key === 'customer') {
        name = value;
      }

      if (key === 'phone' || key === 'phone_number') {
        phone = value;
      }
    }

    return { name, phone };
  }, []);

  const pendingCustomerFallback = useMemo(
    () => parsePendingCustomerFromNotes(approvingOpening?.notes),
    [approvingOpening?.notes, parsePendingCustomerFromNotes],
  );
  const approvalCustomerName = approvingOpening?.booked_by_name || pendingCustomerFallback.name || 'Name not provided';
  const approvalCustomerPhone = approvingOpening?.consumer_phone || pendingCustomerFallback.phone || 'Phone not provided';
  const handleApprovalDialogOpenChange = (nextOpen: boolean) => {
    setApprovalDialogOpen(nextOpen);
    if (!nextOpen) {
      setApprovingOpening(null);
    }
  };

  return (
    <>
      <div className="relative">
        {isCanceledLocked && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-background/70 backdrop-blur-[2px] animate-in fade-in-0 duration-200">
            <div className="max-w-md rounded-lg border bg-card px-6 py-4 text-center shadow-sm">
              <p className="text-sm text-muted-foreground">
                Your subscription has ended. Reactivate to manage openings.
              </p>
              <Button asChild size="sm" className="mt-3">
                <Link to="/merchant/billing">Reactivate Subscription</Link>
              </Button>
            </div>
          </div>
        )}
        {isReadOnlyAccess && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/70 backdrop-blur-[2px] animate-in fade-in-0 duration-200">
            <div className="max-w-md rounded-lg border bg-card px-6 py-4 text-center shadow-sm">
              <p className="text-sm text-muted-foreground">
                Subscription required to manage openings
              </p>
            </div>
          </div>
        )}
        <div
          className={
            isCanceledLocked
              ? 'pointer-events-none blur-sm'
              : isReadOnlyAccess
                ? 'pointer-events-none opacity-60'
                : ''
          }
        >
          <div className="pb-1">
            <h1 className="text-3xl font-bold">Openings</h1>
          </div>

          <OpeningsHeader
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            onPreviousDay={handlePreviousDay}
            onNextDay={handleNextDay}
            onToday={handleToday}
            onAddOpening={handleAddOpening}
            disableAddOpening={isActionBlocked}
            currentView={currentView}
            onViewChange={handleViewChange}
            staffOptions={staff}
            staffFilter={staffFilter}
            onStaffFilterChange={setStaffFilter}
          />

          {/* Calendar content with proper spacing */}
          <div className="mt-3 md:mt-4 pb-2">
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
                  openings={filteredOpenings}
                  workingHours={workingHours}
                  onTimeSlotClick={handleTimeSlotClick}
                  onOpeningClick={handleOpeningClick}
                  onViewChange={handleViewChange}
                  onDateChange={setCurrentDate}
                  highlightedOpeningId={highlightedOpeningId}
                  profileDefaultDuration={profile?.default_opening_duration || undefined}
                  onPreviousDay={handlePreviousDay}
                  onNextDay={handleNextDay}
                  getStaffName={getStaffName}
                />
              </>
            )}
          </div>

          {/* Mobile FAB - only shown on mobile */}
          <div className="md:hidden">
            <AddOpeningCTA
              onClick={handleAddOpening}
              variant="fab"
              disabled={isActionBlocked}
              setupSectionId="create-opening"
            />
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
        staffOptions={staff}
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
        staffName={getStaffName(selectedOpening?.staff_id || null) || primaryStaff?.name || null}
        onApprove={selectedOpening?.status === 'pending_confirmation' ? handleModalApprove : undefined}
        onReject={selectedOpening?.status === 'pending_confirmation' ? handleModalReject : undefined}
        actionLoading={bookingActionLoading}
      />

      {/* Approval Dialog */}
      <AlertDialog open={approvalDialogOpen} onOpenChange={handleApprovalDialogOpenChange}>
        <AlertDialogContent
          className="w-[95vw] max-w-[520px] max-h-[85vh] overflow-hidden rounded-2xl"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Booking Request</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-1">
                <p className="text-sm text-muted-foreground">A customer wants to book this opening.</p>
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-3 space-y-2 text-foreground">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{approvalCustomerName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{approvalCustomerPhone}</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Would you like to approve this booking?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 pt-1">
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
