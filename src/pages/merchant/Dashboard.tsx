import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MoreVertical, Pencil, Trash2, CheckCircle2, XCircle, User, Phone, Calendar, Plus, CalendarIcon, Clock, X } from "lucide-react";
import MerchantLayout from "@/components/merchant/MerchantLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CalendarView } from "@/components/merchant/calendar/CalendarView";
import { TwoDayView } from "@/components/merchant/calendar/TwoDayView";
import { View } from 'react-big-calendar';
import { cn } from "@/lib/utils";

const MerchantDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [metrics, setMetrics] = useState({
    notificationsSent: 0,
    appointmentsBooked: 0,
    estimatedRevenue: 0,
    avgAppointmentValue: 70,
  });
  const [recentSlots, setRecentSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<any>(null);
  const [editStartTime, setEditStartTime] = useState("");
  const [editDuration, setEditDuration] = useState<number>(30);
  const [editAppointmentName, setEditAppointmentName] = useState("");
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSlot, setDeletingSlot] = useState<any>(null);

  // Approval dialog state
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);

  // Quick-add drawer state
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState<Date | undefined>(new Date());
  const [quickAddHour, setQuickAddHour] = useState<number | null>(9);
  const [quickAddMinute, setQuickAddMinute] = useState<number>(0);
  const [quickAddStart, setQuickAddStart] = useState<Date | null>(null);
  const [quickAddEnd, setQuickAddEnd] = useState<Date | null>(null);
  const [quickAddDuration, setQuickAddDuration] = useState(30);
  const [quickAddName, setQuickAddName] = useState("");
  const [defaultDuration, setDefaultDuration] = useState(30);
  const [quickMode, setQuickMode] = useState(true);
  const [selectedStartTimes, setSelectedStartTimes] = useState<string[]>([]);
  const [savedNames, setSavedNames] = useState<string[]>([]);

  const presetDurations = [15, 20, 25, 30, 45, 60];
  const morningTimes = ["6:00", "6:30", "7:00", "7:30", "8:00", "8:30", "9:00", "9:30", "10:00", "10:30", "11:00", "11:30"];
  const afternoonTimes = ["12:00", "12:30", "1:00", "1:30", "2:00", "2:30", "3:00", "3:30", "4:00", "4:30", "5:00", "5:30"];
  const eveningTimes = ["6:00", "6:30", "7:00", "7:30", "8:00", "8:30", "9:00"];

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Helper functions
  const toggleStartTime = (time: string) => {
    setSelectedStartTimes(prev => 
      prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time]
    );
  };

  const deleteSavedName = async (nameToDelete: string) => {
    if (!user) return;
    const updatedNames = savedNames.filter(name => name !== nameToDelete);
    setSavedNames(updatedNames);
    
    await supabase
      .from('profiles')
      .update({ saved_appointment_names: updatedNames })
      .eq('id', user.id);
    
    if (quickAddName === nameToDelete) setQuickAddName("");
  };

  const formatTime12Hour = (hour: number) => {
    if (hour === 0) return "12am";
    if (hour < 12) return `${hour}am`;
    if (hour === 12) return "12pm";
    return `${hour - 12}pm`;
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;

      try {
        // Fetch profile for avg appointment value, default duration, and saved names
        const { data: profile } = await supabase
          .from('profiles')
          .select('avg_appointment_value, default_opening_duration, saved_appointment_names')
          .eq('id', user.id)
          .single();

        if (profile?.default_opening_duration) {
          setDefaultDuration(profile.default_opening_duration);
        }
        
        if (profile?.saved_appointment_names) {
          setSavedNames(profile.saved_appointment_names);
        }

        // Fetch slots with appointment_name
        const { data: slots } = await supabase
          .from('slots')
          .select('*')
          .eq('merchant_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        // Fetch notifications count
        const { count: notificationCount } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('merchant_id', user.id);

        const bookedSlots = slots?.filter(s => s.status === 'booked').length || 0;
        const avgValue = profile?.avg_appointment_value || 70;

        setMetrics({
          notificationsSent: notificationCount || 0,
          appointmentsBooked: bookedSlots,
          estimatedRevenue: bookedSlots * avgValue,
          avgAppointmentValue: avgValue,
        });

        // Format slots for display
        const formattedSlots = slots?.map(slot => {
          const startTime = new Date(slot.start_time);
          const endTime = new Date(slot.end_time);
          const timeStr = `${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
          
          return {
            id: slot.id,
            time: timeStr,
            startTime: slot.start_time,
            endTime: slot.end_time,
            durationMinutes: slot.duration_minutes,
            appointmentName: slot.appointment_name,
            status: slot.status,
            customer: slot.booked_by_name,
            consumerPhone: slot.consumer_phone,
          };
        }) || [];

        setRecentSlots(formattedSlots);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    // Real-time subscription for slot updates
    const channel = supabase
      .channel('dashboard-slots')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'slots',
          filter: `merchant_id=eq.${user?.id}`,
        },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Check for approval query parameter
  useEffect(() => {
    const approveSlotId = searchParams.get('approve');
    
    if (approveSlotId && recentSlots.length > 0) {
      const slotToApprove = recentSlots.find(s => s.id === approveSlotId);
      if (slotToApprove && slotToApprove.status === 'pending_confirmation') {
        setEditingSlot(slotToApprove);
        setApprovalDialogOpen(true);
        // Clear the query param
        searchParams.delete('approve');
        setSearchParams(searchParams);
      }
    }
  }, [searchParams, recentSlots, setSearchParams]);

  const handleEditSlot = (slot: any) => {
    setEditingSlot(slot);
    const startTime = new Date(slot.startTime);
    const hours = startTime.getHours();
    const minutes = startTime.getMinutes();
    setEditStartTime(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
    setEditDuration(slot.durationMinutes);
    setEditAppointmentName(slot.appointmentName || "");
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editStartTime || !editingSlot) return;

    try {
      const [hours, minutes] = editStartTime.split(':').map(Number);
      const startTime = new Date();
      startTime.setHours(hours, minutes, 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + editDuration);

      const { error } = await supabase
        .from('slots')
        .update({
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          duration_minutes: editDuration,
          appointment_name: editAppointmentName.trim() || null,
        })
        .eq('id', editingSlot.id);

      if (error) throw error;

      toast({
        title: "Opening updated",
        description: "Your opening has been updated successfully.",
      });

      // Update local state immediately
      const newStartTime = startTime;
      const newEndTime = endTime;
      const timeStr = `${newStartTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${newEndTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      
      setRecentSlots(prev => 
        prev.map(s => s.id === editingSlot.id 
          ? {
              ...s,
              time: timeStr,
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              durationMinutes: editDuration,
              appointmentName: editAppointmentName.trim() || null,
            }
          : s
        )
      );

      setEditDialogOpen(false);
      setEditingSlot(null);
    } catch (error: any) {
      console.error('Error updating slot:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update opening",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSlot = (slot: any) => {
    setDeletingSlot(slot);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingSlot) return;

    try {
      const { error } = await supabase
        .from('slots')
        .delete()
        .eq('id', deletingSlot.id);

      if (error) throw error;

      toast({
        title: "Opening deleted",
        description: "The opening has been removed successfully.",
      });

      // Update local state immediately
      setRecentSlots(prev => prev.filter(s => s.id !== deletingSlot.id));

      setDeleteDialogOpen(false);
      setDeletingSlot(null);
    } catch (error: any) {
      console.error('Error deleting slot:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete opening",
        variant: "destructive",
      });
    }
  };

  const handleApproveBooking = async (slot: any) => {
    const { error } = await supabase
      .from('slots')
      .update({ status: 'booked' })
      .eq('id', slot.id);

    if (error) {
      toast({
        title: "Approval failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Send confirmation SMS to consumer
    if (slot.consumerPhone) {
      const startTime = new Date(slot.startTime);
      const endTime = new Date(slot.endTime);
      const timeStr = `${format(startTime, "h:mm a")} - ${format(endTime, "h:mm a")}`;
      const message = `✅ Your booking for ${timeStr} has been confirmed! See you there.`;

      await supabase.functions.invoke('send-sms', {
        body: {
          to: slot.consumerPhone,
          message: message,
        },
      });
    }

    toast({
      title: "Booking approved",
      description: "The customer has been notified.",
    });

    // Update local state immediately
    setRecentSlots(prev => 
      prev.map(s => s.id === slot.id ? { ...s, status: 'booked' } : s)
    );

    setApprovalDialogOpen(false);
  };

  const handleRejectBooking = async (slot: any) => {
    const { error } = await supabase
      .from('slots')
      .update({ 
        status: 'open',
        booked_by_name: null,
        consumer_phone: null,
        booked_by_consumer_id: null,
      })
      .eq('id', slot.id);

    if (error) {
      toast({
        title: "Rejection failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Send rejection SMS to consumer
    if (slot.consumerPhone) {
      const message = `We're sorry, but your booking request couldn't be confirmed. Please contact us to reschedule.`;
      
      await supabase.functions.invoke('send-sms', {
        body: {
          to: slot.consumerPhone,
          message: message,
        },
      });
    }

    toast({
      title: "Booking rejected",
      description: "The slot has been reopened.",
    });

    // Update local state immediately
    setRecentSlots(prev => 
      prev.map(s => s.id === slot.id 
        ? { ...s, status: 'open', customer: null, consumerPhone: null } 
        : s
      )
    );

    setApprovalDialogOpen(false);
  };

  const handleEventClick = (slot: any) => {
    if (slot.status === 'open') {
      handleEditSlot(slot);
    } else if (slot.status === 'pending_confirmation') {
      setEditingSlot(slot);
      setApprovalDialogOpen(true);
    }
  };

  const handleCalendarSelect = (slotInfo: { start: Date; end: Date }) => {
    // Pre-fill from calendar interaction
    setQuickAddDate(slotInfo.start);
    setQuickAddHour(slotInfo.start.getHours());
    setQuickAddMinute(slotInfo.start.getMinutes());
    setQuickAddStart(slotInfo.start);
    setQuickAddEnd(slotInfo.end);
    
    // Calculate duration from drag length
    const durationMinutes = Math.round((slotInfo.end.getTime() - slotInfo.start.getTime()) / (1000 * 60));
    setQuickAddDuration(durationMinutes);
    setQuickAddName("");
    setQuickMode(true); // Default to quick mode for calendar drag
    setSelectedStartTimes([]); // Clear bulk selections
    setQuickAddOpen(true);
  };

  // Update quick-add times when date/hour/minute/duration changes
  const updateQuickAddTimes = (date: Date | undefined, hour: number | null, minute: number, duration: number) => {
    if (!date || hour === null) {
      setQuickAddStart(null);
      setQuickAddEnd(null);
      return;
    }
    
    const start = new Date(date);
    start.setHours(hour, minute, 0, 0);
    setQuickAddStart(start);
    
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + duration);
    setQuickAddEnd(end);
  };

  // Helper to handle button click (no pre-fill)
  const handleAddOpeningClick = () => {
    const now = new Date();
    setQuickAddDate(now);
    setQuickAddHour(9);
    setQuickAddMinute(0);
    setQuickAddDuration(defaultDuration);
    setQuickAddName("");
    setQuickMode(true); // Default to quick mode
    setSelectedStartTimes([]); // Clear bulk selections
    updateQuickAddTimes(now, 9, 0, defaultDuration);
    setQuickAddOpen(true);
  };

  const handleQuickAddSave = async () => {
    if (!user) return;

    try {
      // Save appointment name if it's new and not empty
      if (quickAddName.trim() && !savedNames.includes(quickAddName.trim())) {
        const updatedNames = [...savedNames, quickAddName.trim()];
        setSavedNames(updatedNames);
        
        await supabase
          .from('profiles')
          .update({ saved_appointment_names: updatedNames })
          .eq('id', user.id);
      }

      if (quickMode) {
        // Quick Mode: Create single slot
        if (!quickAddStart || !quickAddEnd) return;
        
        const { error } = await supabase.from('slots').insert({
          merchant_id: user.id,
          start_time: quickAddStart.toISOString(),
          end_time: quickAddEnd.toISOString(),
          duration_minutes: quickAddDuration,
          appointment_name: quickAddName.trim() || null,
          status: 'open',
        });

        if (error) throw error;

        toast({
          title: "Opening created",
          description: `${format(quickAddStart, "MMM d 'at' h:mm a")} added successfully.`,
        });
      } else {
        // Bulk Mode: Create multiple slots
        if (!quickAddDate || selectedStartTimes.length === 0) return;
        
        const slotsToCreate = selectedStartTimes.map(timeStr => {
          const [hours, minutes] = timeStr.split(':').map(num => parseInt(num));
          const startTime = new Date(quickAddDate);
          startTime.setHours(hours, minutes, 0, 0);
          
          const endTime = new Date(startTime);
          endTime.setMinutes(endTime.getMinutes() + quickAddDuration);
          
          return {
            merchant_id: user.id,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            duration_minutes: quickAddDuration,
            appointment_name: quickAddName.trim() || null,
            status: 'open',
          };
        });

        const { error } = await supabase.from('slots').insert(slotsToCreate);

        if (error) throw error;

        toast({
          title: "Openings created",
          description: `${slotsToCreate.length} openings added successfully.`,
        });
      }

      setQuickAddOpen(false);
      setSelectedStartTimes([]); // Clear selections
    } catch (error: any) {
      console.error('Error creating slot:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create opening",
        variant: "destructive",
      });
    }
  };

  return (
    <MerchantLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Manage Openings</h1>
            <p className="text-muted-foreground">View and manage your openings and bookings</p>
          </div>
          
          <Button
            variant="default"
            size="sm"
            onClick={handleAddOpeningClick}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Opening
          </Button>
        </div>

        {/* Calendar View */}
        {isMobile ? (
          <TwoDayView 
            slots={recentSlots}
            onEventClick={handleEventClick}
          />
        ) : (
          <Card className="p-4 lg:p-6">
            <CalendarView 
              slots={recentSlots}
              onEventClick={handleEventClick}
              onSelectSlot={handleCalendarSelect}
              defaultView="week"
            />
          </Card>
        )}

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Opening</DialogTitle>
              <DialogDescription>
                Update the time, duration, and appointment type for this opening.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Appointment Name */}
              <div className="space-y-2">
                <Label>Appointment Type (Optional)</Label>
                <Input
                  placeholder="e.g., Haircut, Consultation"
                  value={editAppointmentName}
                  onChange={(e) => setEditAppointmentName(e.target.value)}
                />
              </div>

              {/* Start Time */}
              <div className="space-y-2">
                <Label>Start Time</Label>
                {editingSlot && (
                  <div className="text-sm text-muted-foreground mb-2">
                    Currently: {editingSlot.time}
                  </div>
                )}
                <Input
                  type="time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                />
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label>Duration</Label>
                <div className="grid grid-cols-3 gap-2">
                  {presetDurations.map((duration) => (
                    <Button
                      key={duration}
                      variant={editDuration === duration ? "default" : "outline"}
                      onClick={() => setEditDuration(duration)}
                      className="h-12"
                    >
                      {duration} min
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Opening?</AlertDialogTitle>
              <AlertDialogDescription>
                {deletingSlot && (
                  <div className="space-y-2">
                    <p>Are you sure you want to delete this opening?</p>
                    <div className="bg-secondary p-3 rounded-md text-foreground">
                      {deletingSlot.appointmentName && (
                        <div className="font-semibold">{deletingSlot.appointmentName}</div>
                      )}
                      <div>{deletingSlot.time}</div>
                      <div className="text-sm text-muted-foreground">
                        ({deletingSlot.durationMinutes} minutes)
                      </div>
                    </div>
                    <p className="text-destructive font-medium">This action cannot be undone.</p>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Approval Dialog */}
        <AlertDialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Approve Booking Request?</AlertDialogTitle>
              <AlertDialogDescription>
                {editingSlot && (
                  <div className="space-y-2">
                    <p>Do you want to confirm this booking?</p>
                    <div className="bg-secondary p-3 rounded-md text-foreground">
                      {editingSlot.appointmentName && (
                        <div className="font-semibold">{editingSlot.appointmentName}</div>
                      )}
                      <div className="font-medium">{editingSlot.customer}</div>
                      <div>{editingSlot.time}</div>
                      <div className="text-sm text-muted-foreground">
                        ({editingSlot.durationMinutes} minutes)
                      </div>
                    </div>
                    <p className="text-sm">The customer will receive a confirmation SMS.</p>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => editingSlot && handleRejectBooking(editingSlot)}>
                Reject
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => editingSlot && handleApproveBooking(editingSlot)}
                className="bg-success text-success-foreground hover:bg-success/90"
              >
                Approve
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Quick-Add Opening Drawer */}
        <Drawer open={quickAddOpen} onOpenChange={setQuickAddOpen}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader>
              <DrawerTitle>Add Opening</DrawerTitle>
              <DrawerDescription>Create new time slot{quickMode ? '' : 's'}</DrawerDescription>
            </DrawerHeader>
            
            <ScrollArea className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="space-y-4">
                {/* Date, Duration, Mode Toggle, Time Selection, and Appointment Name */}
                {/* Simplified implementation - keeping existing logic */}
                <div>
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !quickAddDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {quickAddDate ? format(quickAddDate, "EEEE, MMMM d, yyyy") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent mode="single" selected={quickAddDate} onSelect={(date) => { setQuickAddDate(date); updateQuickAddTimes(date, quickAddHour, quickAddMinute, quickAddDuration); }} disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} initialFocus className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>

                <div><Label>Duration</Label><div className="grid grid-cols-3 gap-2 md:grid-cols-6">{presetDurations.map((duration) => (<Button key={duration} variant={quickAddDuration === duration ? "default" : "outline"} onClick={() => { setQuickAddDuration(duration); updateQuickAddTimes(quickAddDate, quickAddHour, quickAddMinute, duration); }} className="h-10">{duration}m</Button>))}</div></div>

                <div className="flex gap-2"><Button variant={quickMode ? "default" : "outline"} onClick={() => { setQuickMode(true); setSelectedStartTimes([]); }} className="flex-1">Quick Mode</Button><Button variant={!quickMode ? "default" : "outline"} onClick={() => setQuickMode(false)} className="flex-1">Bulk Mode</Button></div>

                {quickMode ? (<div><Label>Start Time</Label><div className="grid grid-cols-2 gap-3"><Select value={quickAddHour?.toString() || ""} onValueChange={(value) => { const hour = parseInt(value); setQuickAddHour(hour); updateQuickAddTimes(quickAddDate, hour, quickAddMinute, quickAddDuration); }}><SelectTrigger><SelectValue placeholder="Hour" /></SelectTrigger><SelectContent>{Array.from({ length: 15 }, (_, i) => i + 6).map((hour) => (<SelectItem key={hour} value={hour.toString()}>{formatTime12Hour(hour)}</SelectItem>))}</SelectContent></Select><Select value={quickAddMinute.toString()} onValueChange={(value) => { const minute = parseInt(value); setQuickAddMinute(minute); updateQuickAddTimes(quickAddDate, quickAddHour, minute, quickAddDuration); }}><SelectTrigger><SelectValue placeholder="Min" /></SelectTrigger><SelectContent><SelectItem value="0">:00</SelectItem><SelectItem value="15">:15</SelectItem><SelectItem value="30">:30</SelectItem><SelectItem value="45">:45</SelectItem></SelectContent></Select></div>{quickAddStart && (<div className="mt-2 p-3 bg-muted rounded-md"><p className="text-sm font-medium">📅 {format(quickAddStart, "EEEE, MMMM d")} at {format(quickAddStart, "h:mm a")}</p><p className="text-xs text-muted-foreground">Duration: {quickAddDuration} minutes</p></div>)}</div>) : (<div><Label>Select Times (Bulk)</Label><div className="text-sm text-muted-foreground mb-2">Select multiple start times for {format(quickAddDate!, "MMM d")}</div><div className="grid grid-cols-4 gap-2">{[...morningTimes, ...afternoonTimes, ...eveningTimes].map(time => (<Button key={time} size="sm" variant={selectedStartTimes.includes(time) ? "default" : "outline"} onClick={() => toggleStartTime(time)}>{time}</Button>))}</div>{selectedStartTimes.length > 0 && (<div className="mt-3 flex flex-wrap gap-2">{selectedStartTimes.map(time => (<Badge key={time} variant="secondary" className="gap-1">{time}<X className="h-3 w-3 cursor-pointer" onClick={() => toggleStartTime(time)} /></Badge>))}</div>)}</div>)}

                <div><Label htmlFor="quick-add-name">Appointment Name (optional)</Label><Input id="quick-add-name" value={quickAddName} onChange={(e) => setQuickAddName(e.target.value)} placeholder="e.g., Haircut" />{savedNames.length > 0 && (<div className="mt-2 flex flex-wrap gap-2">{savedNames.map(name => (<Badge key={name} variant="outline" className="cursor-pointer" onClick={() => setQuickAddName(name)}>{name}<X className="h-3 w-3 ml-1" onClick={(e) => { e.stopPropagation(); deleteSavedName(name); }} /></Badge>))}</div>)}</div>
              </div>
            </ScrollArea>

            <DrawerFooter>
              <Button onClick={handleQuickAddSave} disabled={quickMode ? !quickAddStart : selectedStartTimes.length === 0}>Create Opening{quickMode ? '' : 's'}</Button>
              <DrawerClose asChild><Button variant="outline">Cancel</Button></DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    </MerchantLayout>
  );
};

export default MerchantDashboard;
