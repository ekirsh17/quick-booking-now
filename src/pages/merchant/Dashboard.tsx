import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MoreVertical, Pencil, Trash2, CheckCircle2, XCircle, User, Phone, Building2, MapPin, Settings as SettingsIcon } from "lucide-react";
import MerchantLayout from "@/components/merchant/MerchantLayout";
import { useAuth } from "@/hooks/useAuth";
import { useMerchantProfile } from "@/hooks/useMerchantProfile";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const MerchantDashboard = () => {
  const { user } = useAuth();
  const { profile } = useMerchantProfile();
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

  const presetDurations = [15, 20, 25, 30, 45, 60];

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;

      try {
        // Fetch profile for avg appointment value
        const { data: profile } = await supabase
          .from('profiles')
          .select('avg_appointment_value')
          .eq('id', user.id)
          .single();

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

  return (
    <MerchantLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            {profile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Building2 className="w-4 h-4" />
                <span>{profile.business_name}</span>
              </div>
            )}
            <h1 className="text-3xl font-bold">Manage Openings</h1>
            <p className="text-muted-foreground">View and manage your openings and bookings</p>
          </div>
          <Button asChild size="lg">
            <Link to="/merchant/add-availability">+ Add Opening</Link>
          </Button>
        </div>

        {/* Business Summary Card */}
        {profile && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                {profile.business_name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <a href={`tel:${profile.phone}`} className="hover:underline">
                  {profile.phone}
                </a>
              </div>
              {profile.address && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{profile.address}</span>
                </div>
              )}
              <div className="pt-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/merchant/settings">
                    <SettingsIcon className="w-4 h-4 mr-2" />
                    Update Business Info
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        <Card>
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Your Openings</h2>
          </div>
          <div className="divide-y">
            {loading ? (
              <div className="p-6 text-center text-muted-foreground">
                Loading...
              </div>
            ) : recentSlots.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                No slots yet. Add your first opening to get started!
              </div>
            ) : (
              recentSlots.map((slot) => (
                <div key={slot.id} className="p-6 flex items-center justify-between">
                  <div className="flex-1">
                    {slot.appointmentName && (
                      <Badge variant="secondary" className="mb-2">
                        {slot.appointmentName}
                      </Badge>
                    )}
                    <div className="font-medium">{slot.time}</div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {slot.status === 'booked' || slot.status === 'pending_confirmation' ? (
                        <>
                          {slot.customer && (
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5" />
                              <span>{slot.customer}</span>
                            </div>
                          )}
                          {slot.consumerPhone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-3.5 w-3.5" />
                              <a 
                                href={`tel:${slot.consumerPhone}`}
                                className="hover:underline hover:text-foreground"
                              >
                                {slot.consumerPhone}
                              </a>
                            </div>
                          )}
                        </>
                      ) : (
                        <div>{slot.status}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant={
                        slot.status === 'booked' ? 'default' : 
                        slot.status === 'pending_confirmation' ? 'secondary' : 
                        'outline'
                      }
                      className={
                        slot.status === 'pending_confirmation' 
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-100' 
                          : ''
                      }
                    >
                      {slot.status === 'booked' ? 'Booked' : 
                       slot.status === 'pending_confirmation' ? 'Pending' :
                       'Open'}
                    </Badge>
                    {slot.status === 'open' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditSlot(slot)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Opening
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteSlot(slot)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Opening
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {slot.status === 'pending_confirmation' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleApproveBooking(slot)}>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Approve Booking
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleRejectBooking(slot)}
                            className="text-destructive"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject Booking
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-6 border-t">
            <Button asChild variant="outline" className="w-full">
              <Link to="/merchant/analytics">View Reports</Link>
            </Button>
          </div>
        </Card>

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
      </div>
    </MerchantLayout>
  );
};

export default MerchantDashboard;
