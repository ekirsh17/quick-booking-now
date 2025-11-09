import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Check, Trash2 } from "lucide-react";
import MerchantLayout from "@/components/merchant/MerchantLayout";
import { supabase } from "@/integrations/supabase/client";
import { WorkingHours } from "@/types/openings";

const Account = () => {
  const { toast } = useToast();
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [requireConfirmation, setRequireConfirmation] = useState(false);
  const [useBookingSystem, setUseBookingSystem] = useState(false);
  const [defaultDuration, setDefaultDuration] = useState<number | ''>(30);
  const [savedAppointmentNames, setSavedAppointmentNames] = useState<string[]>([]);
  const [newAppointmentType, setNewAppointmentType] = useState('');
  const [newDuration, setNewDuration] = useState('');
  const [profile, setProfile] = useState<{
    business_name: string;
    phone: string;
    address: string | null;
    saved_appointment_names: string[] | null;
    saved_durations: number[] | null;
    default_opening_duration: number | null;
  } | null>(null);
  const [workingHours, setWorkingHours] = useState<WorkingHours>({
    monday: { enabled: true, start: '06:00', end: '20:00' },
    tuesday: { enabled: true, start: '06:00', end: '20:00' },
    wednesday: { enabled: true, start: '06:00', end: '20:00' },
    thursday: { enabled: true, start: '06:00', end: '20:00' },
    friday: { enabled: true, start: '06:00', end: '20:00' },
    saturday: { enabled: true, start: '06:00', end: '20:00' },
    sunday: { enabled: true, start: '06:00', end: '20:00' },
  });
  const [loading, setLoading] = useState(true);
  const [sendingTest, setSendingTest] = useState(false);

  const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  const HOURS = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return { value: `${hour}:00`, label: `${i === 0 ? 12 : i > 12 ? i - 12 : i}:00 ${i < 12 ? 'AM' : 'PM'}` };
  });

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('business_name, phone, address, booking_url, require_confirmation, use_booking_system, default_opening_duration, working_hours, saved_appointment_names, saved_durations')
        .eq('id', user.id)
        .single();

      if (profile) {
        setBusinessName(profile.business_name || "");
        setPhone(profile.phone || "");
        setAddress(profile.address || "");
        setBookingUrl(profile.booking_url || "");
        setRequireConfirmation(profile.require_confirmation || false);
        setUseBookingSystem(profile.use_booking_system || false);
        setDefaultDuration(profile.default_opening_duration || 30);
        setSavedAppointmentNames(profile.saved_appointment_names || []);
        setProfile(profile);
        if (profile.working_hours) {
          setWorkingHours(profile.working_hours as WorkingHours);
        }
      }
      setLoading(false);
    };

    fetchProfile();
  }, []);

  const handleSave = async () => {
    // Validate booking URL if use_booking_system is enabled
    if (useBookingSystem && !bookingUrl.trim()) {
      toast({
        title: "Booking URL Required",
        description: "Please enter your booking system URL.",
        variant: "destructive",
      });
      return;
    }

    // Validate URL format
    if (useBookingSystem && bookingUrl.trim()) {
      try {
        new URL(bookingUrl);
      } catch {
        toast({
          title: "Invalid URL",
          description: "Please enter a valid URL (e.g., https://example.com)",
          variant: "destructive",
        });
        return;
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        business_name: businessName,
        phone: phone,
        address: address,
        booking_url: useBookingSystem ? bookingUrl : null,
        require_confirmation: requireConfirmation,
        use_booking_system: useBookingSystem,
        default_opening_duration: typeof defaultDuration === 'number' ? defaultDuration : 30,
        working_hours: workingHours,
      })
      .eq('id', user.id);

    if (error) {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "✅ Settings saved",
      description: "Your changes have been updated successfully.",
    });
  };

  const handleSendTestSMS = async () => {
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          to: '+15165879844',
          message: `Test from ${businessName || 'NotifyMe'}: Direct number routing ✅`,
        },
      });

      if (error) throw error;

      toast({
        title: "SMS Sent Successfully",
        description: `SID: ${data.messageSid} | Via: ${data.via || 'direct'}`,
      });
    } catch (error: any) {
      toast({
        title: "Send Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingTest(false);
    }
  };

  const handleDeleteAppointmentType = async (name: string) => {
    const updatedNames = savedAppointmentNames.filter(n => n !== name);
    setSavedAppointmentNames(updatedNames);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({ saved_appointment_names: updatedNames })
        .eq('id', user.id);
      
      toast({
        title: "Appointment type removed",
        description: `"${name}" has been deleted.`,
      });
    }
  };

  const handleDeleteDuration = async (minutes: number) => {
    const updatedDurations = ((profile?.saved_durations || []) as number[]).filter(d => d !== minutes);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({ saved_durations: updatedDurations })
        .eq('id', user.id);
      
      setProfile(prev => prev ? { ...prev, saved_durations: updatedDurations } : null);
      
      toast({
        title: "Duration removed",
        description: `${formatDurationForSettings(minutes)} has been deleted.`,
      });
    }
  };

  const formatDurationForSettings = (minutes: number): string => {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = minutes / 60;
    return Number.isInteger(hours) 
      ? `${hours} hour${hours > 1 ? 's' : ''}` 
      : `${hours.toFixed(2)} hours`;
  };

  const parseDurationInput = (input: string): number => {
    if (!input) return 0;
    
    const cleaned = input.toLowerCase().trim();
    
    // Handle pure number (assumed minutes)
    if (/^\d+$/.test(cleaned)) {
      return parseInt(cleaned);
    }
    
    // Handle decimal hours (e.g., "1.5")
    if (/^\d+\.\d+$/.test(cleaned)) {
      return Math.round(parseFloat(cleaned) * 60);
    }
    
    // Handle formats like "1h", "1.5h", "90m", "1h 30m"
    let totalMinutes = 0;
    
    const hourMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*h(?:our)?s?/);
    if (hourMatch) {
      totalMinutes += parseFloat(hourMatch[1]) * 60;
    }
    
    const minuteMatch = cleaned.match(/(\d+)\s*m(?:in)?(?:ute)?s?/);
    if (minuteMatch) {
      totalMinutes += parseInt(minuteMatch[1]);
    }
    
    return Math.round(totalMinutes);
  };

  const handleCanaryTest = async () => {
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('sms-canary', {
        body: { to: '+15165879844' },
      });

      if (error) throw error;

      console.log('🧪 Canary result:', data);
      
      if (data.canary === 'success') {
        const isTollFree = data.from === '+18448203482';
        const message = isTollFree 
          ? `✅ Using TOLL-FREE: ${data.from}`
          : `⚠️ Using OLD NUMBER: ${data.from}\n\nYou need to update TWILIO_PHONE_NUMBER secret to: +18448203482`;
        
        alert(message);
        
        toast({
          title: isTollFree ? "✅ Toll-Free Active" : "⚠️ Using Old Number",
          description: `FROM: ${data.from} | Status: ${data.status}`,
          duration: 15000,
          variant: isTollFree ? "default" : "destructive",
        });
      } else if (data.canary === 'blocked') {
        alert('⚠️ TESTING_MODE is enabled - only verified numbers allowed');
        toast({
          title: "⚠️ Test Mode Active",
          description: "TESTING_MODE is enabled - only verified numbers allowed",
          duration: 8000,
        });
      } else {
        alert(`❌ Canary Failed: ${data.error || "Unknown error"}`);
        toast({
          title: "❌ Canary Failed",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      alert(`❌ Test Failed: ${error.message}`);
      toast({
        title: "Canary Test Failed",
        description: error.message,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <MerchantLayout>
      <div className="max-w-2xl mx-auto space-y-8 pb-2 relative">
        <div>
          <h1 className="text-3xl font-bold mb-2">Account</h1>
          <p className="text-muted-foreground">
            Manage your business details and preferences
          </p>
        </div>

        {/* Business Information */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Business Information</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="business-name">Business Name</Label>
              <Input
                id="business-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex gap-2 mt-1">
                <PhoneInput
                  value={phone}
                  onChange={(value) => setPhone(value || "")}
                  placeholder="(555) 123-4567"
                  className="flex-1"
                />
                <Button 
                  type="button"
                  variant="outline"
                  onClick={handleSendTestSMS}
                  disabled={sendingTest}
                >
                  {sendingTest ? 'Sending...' : 'Test SMS'}
                </Button>
                <Button 
                  type="button"
                  variant="secondary"
                  onClick={handleCanaryTest}
                  disabled={sendingTest}
                >
                  🧪 Canary
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Canary shows actual sender number | Test SMS sends to +1 516-587-9844
              </p>
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </Card>

        {/* Booking Settings with Accordion */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Booking Settings</h2>
          <p className="text-muted-foreground mb-6">
            Configure how bookings work for your business
          </p>
          
          <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>Default Appointment Duration</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Duration
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="5"
                        max="300"
                        step="5"
                        value={defaultDuration}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Allow empty string during typing
                          if (value === '') {
                            setDefaultDuration('' as any);
                            return;
                          }
                          const parsed = parseInt(value);
                          if (!isNaN(parsed)) {
                            setDefaultDuration(parsed);
                          }
                        }}
                        onBlur={(e) => {
                          const value = e.target.value;
                          if (value === '' || isNaN(parseInt(value))) {
                            setDefaultDuration(30); // Reset to default
                            return;
                          }
                          const parsed = parseInt(value);
                          const rounded = Math.round(parsed / 5) * 5;
                          const clamped = Math.max(5, Math.min(300, rounded));
                          setDefaultDuration(clamped);
                        }}
                        className="w-32"
                        placeholder="30"
                      />
                      <span className="text-sm text-muted-foreground">minutes</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Enter duration in minutes (5-300). Will round to nearest 5 minutes.
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger>Booking System Integration</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Use External Booking System</div>
                      <p className="text-sm text-muted-foreground">
                        Redirect customers to your existing booking platform
                      </p>
                    </div>
                    <Switch
                      checked={useBookingSystem}
                      onCheckedChange={setUseBookingSystem}
                    />
                  </div>

                  {useBookingSystem && (
                    <div className="pt-4 border-t">
                      <Label htmlFor="booking-url">Booking System URL *</Label>
                      <Input
                        id="booking-url"
                        type="url"
                        placeholder="https://booksy.com/your-business"
                        value={bookingUrl}
                        onChange={(e) => setBookingUrl(e.target.value)}
                        className="mt-1"
                        required={useBookingSystem}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Customers will be redirected here to complete their booking
                      </p>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger>Booking Confirmation Settings</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Require Manual Confirmation</div>
                      <p className="text-sm text-muted-foreground">
                        Review and approve each booking request via SMS or dashboard
                      </p>
                    </div>
                    <Switch
                      checked={requireConfirmation}
                      onCheckedChange={setRequireConfirmation}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger>Working Hours</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-muted-foreground mb-3">
                    Set your business hours for each day of the week
                  </p>
                  {DAYS.map((day) => (
                    <div key={day} className="flex items-center gap-3 py-2">
                      <Switch
                        checked={workingHours[day]?.enabled || false}
                        onCheckedChange={(enabled) => {
                          setWorkingHours({
                            ...workingHours,
                            [day]: {
                              ...workingHours[day],
                              enabled,
                            },
                          });
                        }}
                      />
                      <div className="w-24 font-medium capitalize text-sm">{day}</div>
                      {workingHours[day]?.enabled && (
                        <div className="flex items-center gap-2 flex-1">
                          <select
                            value={workingHours[day]?.start || '06:00'}
                            onChange={(e) => {
                              setWorkingHours({
                                ...workingHours,
                                [day]: {
                                  ...workingHours[day],
                                  start: e.target.value,
                                },
                              });
                            }}
                            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {HOURS.map((hour) => (
                              <option key={hour.value} value={hour.value}>
                                {hour.label}
                              </option>
                            ))}
                          </select>
                          <span className="text-sm text-muted-foreground">to</span>
                          <select
                            value={workingHours[day]?.end || '20:00'}
                            onChange={(e) => {
                              setWorkingHours({
                                ...workingHours,
                                [day]: {
                                  ...workingHours[day],
                                  end: e.target.value,
                                },
                              });
                            }}
                            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {HOURS.map((hour) => (
                              <option key={hour.value} value={hour.value}>
                                {hour.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-5">
            <AccordionTrigger>Appointment Types</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  Manage your frequently used appointment types for quick access when adding openings.
                </p>
                
                {/* List of saved types */}
                <div className="space-y-2">
                  {savedAppointmentNames.map((name, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded-lg">
                      <span className="text-sm">{name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          const updatedNames = savedAppointmentNames.filter(n => n !== name);
                          setSavedAppointmentNames(updatedNames);
                          
                          const { data: { user } } = await supabase.auth.getUser();
                          if (user) {
                            await supabase
                              .from('profiles')
                              .update({ saved_appointment_names: updatedNames })
                              .eq('id', user.id);
                            
                            toast({
                              title: "Appointment type removed",
                            });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  {savedAppointmentNames.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No saved appointment types yet. Add types from the opening modal or below.
                    </p>
                  )}
                </div>
                
                {/* Add new type */}
                <div className="flex gap-2">
                  <Input
                    value={newAppointmentType}
                    onChange={(e) => setNewAppointmentType(e.target.value)}
                    placeholder="Add new appointment type"
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && newAppointmentType.trim()) {
                        const updatedNames = [...savedAppointmentNames, newAppointmentType.trim()];
                        setSavedAppointmentNames(updatedNames);
                        
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user) {
                          await supabase
                            .from('profiles')
                            .update({ saved_appointment_names: updatedNames })
                            .eq('id', user.id);
                          
                          setNewAppointmentType('');
                          toast({
                            title: "Appointment type added",
                          });
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={async () => {
                      if (!newAppointmentType.trim()) return;
                      
                      const updatedNames = [...savedAppointmentNames, newAppointmentType.trim()];
                      setSavedAppointmentNames(updatedNames);
                      
                      const { data: { user } } = await supabase.auth.getUser();
                      if (user) {
                        await supabase
                          .from('profiles')
                          .update({ saved_appointment_names: updatedNames })
                          .eq('id', user.id);
                        
                        setNewAppointmentType('');
                        toast({
                          title: "Appointment type added",
                        });
                      }
                    }}
                    disabled={!newAppointmentType.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-6">
            <AccordionTrigger>Saved Durations</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  Manage your frequently used durations for quick access when adding openings. Maximum 10 saved durations.
                </p>
                
                <div className="space-y-2">
                  {((profile?.saved_durations || []) as number[]).map((minutes, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded-lg">
                      <span className="text-sm">{formatDurationForSettings(minutes)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDuration(minutes)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                   {(profile?.saved_durations?.length || 0) === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No saved durations yet.
                    </p>
                  )}
                </div>
                
                {/* Add New Duration */}
                <div className="flex gap-2">
                  <Input
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                    placeholder="e.g., 30, 1.5h, 90m"
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && newDuration.trim()) {
                        const parsed = parseDurationInput(newDuration);
                        if (parsed > 0 && parsed <= 480) {
                          const currentDurations = (profile?.saved_durations || []) as number[];
                          
                          if (currentDurations.length >= 10) {
                            toast({
                              title: "Limit reached",
                              description: "Maximum 10 saved durations allowed.",
                              variant: "destructive"
                            });
                            return;
                          }
                          
                          if (!currentDurations.includes(parsed)) {
                            const updatedDurations = [...currentDurations, parsed].sort((a, b) => a - b);
                            
                            const { data: { user } } = await supabase.auth.getUser();
                            if (user) {
                              await supabase
                                .from('profiles')
                                .update({ saved_durations: updatedDurations })
                                .eq('id', user.id);
                              
                              // Refresh profile
                              const { data: updatedProfile } = await supabase
                                .from('profiles')
                                .select('saved_durations')
                                .eq('id', user.id)
                                .single();
                              
                              if (updatedProfile) {
                                setProfile({ ...profile, saved_durations: updatedProfile.saved_durations });
                              }
                              
                              setNewDuration('');
                              toast({
                                title: "Duration added",
                                description: `${formatDurationForSettings(parsed)} added to your presets.`,
                              });
                            }
                          } else {
                            toast({
                              title: "Already exists",
                              description: "This duration is already saved.",
                            });
                          }
                        } else {
                          toast({
                            title: "Invalid duration",
                            description: "Enter a duration between 5 minutes and 8 hours.",
                            variant: "destructive"
                          });
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={async () => {
                      if (!newDuration.trim()) return;
                      
                      const parsed = parseDurationInput(newDuration);
                      if (parsed > 0 && parsed <= 480) {
                        const currentDurations = (profile?.saved_durations || []) as number[];
                        
                        if (currentDurations.length >= 10) {
                          toast({
                            title: "Limit reached",
                            description: "Maximum 10 saved durations allowed.",
                            variant: "destructive"
                          });
                          return;
                        }
                        
                        if (!currentDurations.includes(parsed)) {
                          const updatedDurations = [...currentDurations, parsed].sort((a, b) => a - b);
                          
                          const { data: { user } } = await supabase.auth.getUser();
                          if (user) {
                            await supabase
                              .from('profiles')
                              .update({ saved_durations: updatedDurations })
                              .eq('id', user.id);
                            
                            // Refresh profile
                            const { data: updatedProfile } = await supabase
                              .from('profiles')
                              .select('saved_durations')
                              .eq('id', user.id)
                              .single();
                            
                            if (updatedProfile) {
                              setProfile({ ...profile, saved_durations: updatedProfile.saved_durations });
                            }
                            
                            setNewDuration('');
                            toast({
                              title: "Duration added",
                              description: `${formatDurationForSettings(parsed)} added to your presets.`,
                            });
                          }
                        } else {
                          toast({
                            title: "Already exists",
                            description: "This duration is already saved.",
                          });
                        }
                      } else {
                        toast({
                          title: "Invalid duration",
                          description: "Enter a duration between 5 minutes and 8 hours.",
                          variant: "destructive"
                        });
                      }
                    }}
                    disabled={!newDuration.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

        {/* Subscription */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Subscription</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Professional Plan</div>
              <p className="text-sm text-muted-foreground">$19/month</p>
            </div>
            <Button variant="outline">Manage Billing</Button>
          </div>
        </Card>

        {/* Floating Save Button */}
        <Button 
          onClick={handleSave} 
          size="lg" 
          className="fixed bottom-32 sm:bottom-28 md:bottom-20 lg:bottom-20 xl:bottom-16 2xl:bottom-12 right-4 sm:right-6 z-50 shadow-2xl h-12 px-6 transition-all flex items-center justify-center" 
          disabled={loading}
        >
          <Check className="mr-2 h-5 w-5" />
          Save Changes
        </Button>
      </div>
    </MerchantLayout>
  );
};

export default Account;
