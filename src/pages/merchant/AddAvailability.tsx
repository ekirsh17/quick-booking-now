import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Clock, X, ChevronDown } from "lucide-react";
import MerchantLayout from "@/components/merchant/MerchantLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const AddAvailability = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [selectedDuration, setSelectedDuration] = useState<number | null>(() => {
    const saved = localStorage.getItem('lastUsedDuration');
    return saved ? parseInt(saved) : null;
  });
  const [customDuration, setCustomDuration] = useState("");
  const [selectedStartTimes, setSelectedStartTimes] = useState<string[]>([]);
  const [appointmentName, setAppointmentName] = useState("");
  const [savedNames, setSavedNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  
  const presetDurations = [15, 30, 45, 60, 90];
  const morningTimes = [
    "6:00", "6:30", "7:00", "7:30", "8:00", "8:30",
    "9:00", "9:30", "10:00", "10:30", "11:00", "11:30"
  ];
  const afternoonTimes = [
    "12:00", "12:30", "1:00", "1:30", "2:00", "2:30",
    "3:00", "3:30", "4:00", "4:30", "5:00", "5:30"
  ];
  const eveningTimes = [
    "6:00", "6:30", "7:00", "7:30", "8:00", "8:30", "9:00"
  ];

  // Load saved appointment names from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('appointmentNames');
    if (saved) {
      setSavedNames(JSON.parse(saved));
    }
  }, []);

  const toggleStartTime = (time: string) => {
    setSelectedStartTimes(prev => 
      prev.includes(time) 
        ? prev.filter(t => t !== time)
        : [...prev, time]
    );
  };

  const deleteSavedName = (nameToDelete: string) => {
    const updatedNames = savedNames.filter(name => name !== nameToDelete);
    setSavedNames(updatedNames);
    localStorage.setItem('appointmentNames', JSON.stringify(updatedNames));
    if (appointmentName === nameToDelete) {
      setAppointmentName("");
    }
  };

  const handleAddSlots = async () => {
    const duration = selectedDuration || parseInt(customDuration);
    
    if (!duration || selectedStartTimes.length === 0) {
      toast({
        title: "Missing information",
        description: "Please select a duration and at least one start time.",
        variant: "destructive",
      });
      return;
    }

    // Save appointment name to localStorage if provided
    if (appointmentName.trim() && !savedNames.includes(appointmentName.trim())) {
      const updatedNames = [...savedNames, appointmentName.trim()];
      setSavedNames(updatedNames);
      localStorage.setItem('appointmentNames', JSON.stringify(updatedNames));
    }

    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to add slots.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Save last used duration for next time
    localStorage.setItem('lastUsedDuration', duration.toString());

    try {
      const now = new Date();
      const slotsToInsert = selectedStartTimes.map(timeStr => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const startTime = new Date(now);
        startTime.setHours(hours, minutes, 0, 0);
        
        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + duration);

        return {
          merchant_id: user.id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          duration_minutes: duration,
          status: 'open',
          appointment_name: appointmentName.trim() || null,
        };
      });

      // Create all slots
      const { data: newSlots, error } = await supabase
        .from('slots')
        .insert(slotsToInsert)
        .select();

      if (error) throw error;

      // Trigger notifications for all slots
      for (const slot of newSlots || []) {
        try {
          await supabase.functions.invoke('notify-consumers', {
            body: {
              slotId: slot.id,
              merchantId: user.id,
            },
          });
        } catch (notifyError) {
          console.error('Failed to notify consumers:', notifyError);
        }
      }

      toast({
        title: "✅ Slots Added",
        description: `Created ${selectedStartTimes.length} opening${selectedStartTimes.length > 1 ? 's' : ''} and notified customers`,
      });
      
      navigate("/merchant/dashboard");
    } catch (error: any) {
      console.error('Error adding slots:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add slots",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <MerchantLayout>
      <div className="max-w-2xl mx-auto space-y-4 lg:space-y-8 pb-32 lg:pb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold mb-1 lg:mb-2">Add Opening</h1>
          <p className="text-sm lg:text-base text-muted-foreground hidden lg:block">
            Select when you have an available appointment slot
          </p>
        </div>

        <Card className="p-4 lg:p-8">
          <div className="space-y-4 lg:space-y-8">
            {/* Duration Selection */}
            <div>
              <Label className="text-base lg:text-lg font-semibold mb-3 lg:mb-4 block">
                Appointment Duration
              </Label>
              
              {/* Mobile: Horizontal Scroll */}
              <div className="lg:hidden">
                <ScrollArea className="w-full">
                  <div className="flex gap-2 pb-2">
                    {presetDurations.map((duration) => (
                      <Button
                        key={duration}
                        variant={selectedDuration === duration ? "default" : "outline"}
                        onClick={() => {
                          setSelectedDuration(duration);
                          setCustomDuration("");
                          setShowCustomInput(false);
                        }}
                        className="flex-shrink-0 w-20 h-16"
                      >
                        <div className="text-center">
                          <div className="text-lg font-bold">{duration}</div>
                          <div className="text-xs">min</div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
                <button 
                  onClick={() => setShowCustomInput(!showCustomInput)}
                  className="text-xs text-muted-foreground underline mt-2 block"
                >
                  Need a different duration?
                </button>
                {showCustomInput && (
                  <Input
                    type="number"
                    placeholder="Custom minutes"
                    value={customDuration}
                    onChange={(e) => {
                      setCustomDuration(e.target.value);
                      setSelectedDuration(null);
                    }}
                    min="5"
                    max="240"
                    className="mt-2"
                  />
                )}
              </div>

              {/* Desktop: Keep existing grid */}
              <div className="hidden lg:block">
                <div className="grid grid-cols-6 gap-3 mb-4">
                  {presetDurations.map((duration) => (
                    <Button
                      key={duration}
                      variant={selectedDuration === duration ? "default" : "outline"}
                      onClick={() => {
                        setSelectedDuration(duration);
                        setCustomDuration("");
                      }}
                      className="h-16"
                    >
                      <div className="text-center">
                        <div className="text-xl font-bold">{duration}</div>
                        <div className="text-xs">min</div>
                      </div>
                    </Button>
                  ))}
                </div>
                
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Custom (minutes)"
                    value={customDuration}
                    onChange={(e) => {
                      setCustomDuration(e.target.value);
                      setSelectedDuration(null);
                    }}
                    min="5"
                    max="240"
                  />
                </div>
              </div>
            </div>

            {/* Start Times - Accordion on Mobile */}
            <div>
              {/* Mobile: Accordion */}
              <div className="lg:hidden">
                <Accordion type="single" collapsible className="border rounded-lg">
                  <AccordionItem value="times" className="border-0">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span className="font-semibold">Select Time(s)</span>
                        </div>
                        {selectedStartTimes.length > 0 && (
                          <Badge variant="secondary" className="mr-2">
                            {selectedStartTimes.length}
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4">
                        {/* Morning */}
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                            Morning
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {morningTimes.map((time) => (
                              <Button
                                key={time}
                                variant={selectedStartTimes.includes(time) ? "default" : "outline"}
                                onClick={() => toggleStartTime(time)}
                                className="h-10 text-sm"
                              >
                                {time}
                              </Button>
                            ))}
                          </div>
                        </div>
                        
                        {/* Afternoon */}
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                            Afternoon
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {afternoonTimes.map((time) => (
                              <Button
                                key={time}
                                variant={selectedStartTimes.includes(time) ? "default" : "outline"}
                                onClick={() => toggleStartTime(time)}
                                className="h-10 text-sm"
                              >
                                {time}
                              </Button>
                            ))}
                          </div>
                        </div>

                        {/* Evening */}
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                            Evening
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {eveningTimes.map((time) => (
                              <Button
                                key={time}
                                variant={selectedStartTimes.includes(time) ? "default" : "outline"}
                                onClick={() => toggleStartTime(time)}
                                className="h-10 text-sm"
                              >
                                {time}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Show selected times as badges */}
                {selectedStartTimes.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-muted-foreground">
                        Selected ({selectedStartTimes.length})
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedStartTimes([])}
                        className="h-7 text-xs"
                      >
                        Clear all
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedStartTimes.sort().map((time) => (
                        <Badge 
                          key={time} 
                          variant="default" 
                          className="text-sm px-3 py-1.5"
                        >
                          {time}
                          <X 
                            className="ml-2 h-3.5 w-3.5 cursor-pointer" 
                            onClick={() => toggleStartTime(time)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop: Keep existing grid layout */}
              <div className="hidden lg:block">
                <Label className="text-lg font-semibold mb-4 block">
                  <Clock className="w-5 h-5 inline mr-2" />
                  Start Time(s)
                </Label>
                <div className="space-y-6">
                  {/* Morning Times */}
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                      Morning (6am - 11:30am)
                    </div>
                    <div className="grid grid-cols-6 gap-2">
                      {morningTimes.map((time) => (
                        <Button
                          key={time}
                          variant={selectedStartTimes.includes(time) ? "default" : "outline"}
                          onClick={() => toggleStartTime(time)}
                          className="h-11 text-sm"
                        >
                          {time}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Afternoon Times */}
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                      Afternoon (12pm - 5:30pm)
                    </div>
                    <div className="grid grid-cols-6 gap-2">
                      {afternoonTimes.map((time) => (
                        <Button
                          key={time}
                          variant={selectedStartTimes.includes(time) ? "default" : "outline"}
                          onClick={() => toggleStartTime(time)}
                          className="h-11 text-sm"
                        >
                          {time}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Evening Times */}
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                      Evening (6pm - 9pm)
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {eveningTimes.map((time) => (
                        <Button
                          key={time}
                          variant={selectedStartTimes.includes(time) ? "default" : "outline"}
                          onClick={() => toggleStartTime(time)}
                          className="h-11 text-sm"
                        >
                          {time}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                {selectedStartTimes.length > 0 && (
                  <div className="mt-4 text-sm text-muted-foreground">
                    {selectedStartTimes.length} time{selectedStartTimes.length > 1 ? 's' : ''} selected
                  </div>
                )}
              </div>
            </div>

            {/* Appointment Name - Collapsible on Mobile */}
            <div>
              {/* Mobile: Collapsible */}
              <div className="lg:hidden">
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                    <ChevronDown className="w-4 h-4" />
                    <span>Add appointment name (optional)</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3 space-y-3">
                    <Input
                      type="text"
                      placeholder="e.g., Haircut, Consultation"
                      value={appointmentName}
                      onChange={(e) => setAppointmentName(e.target.value)}
                    />
                    {savedNames.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {savedNames.map((name) => (
                          <Badge
                            key={name}
                            variant="secondary"
                            className="cursor-pointer px-3 py-1 text-sm gap-2"
                          >
                            <span onClick={() => setAppointmentName(name)}>
                              {name}
                            </span>
                            <X 
                              className="w-3 h-3 hover:text-destructive" 
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSavedName(name);
                              }}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Desktop: Keep existing */}
              <div className="hidden lg:block">
                <Label className="text-lg font-semibold mb-4 block">
                  Appointment Name (Optional)
                </Label>
                <div className="space-y-3">
                  <Input
                    type="text"
                    placeholder="e.g., Haircut, Consultation, Massage"
                    value={appointmentName}
                    onChange={(e) => setAppointmentName(e.target.value)}
                  />
                  {savedNames.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {savedNames.map((name) => (
                        <Badge
                          key={name}
                          variant="secondary"
                          className="cursor-pointer px-3 py-1 text-sm gap-2"
                        >
                          <span onClick={() => setAppointmentName(name)}>
                            {name}
                          </span>
                          <X 
                            className="w-3 h-3 hover:text-destructive" 
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSavedName(name);
                            }}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>


            {/* Preview - Desktop Only */}
            <div className="hidden lg:block">
              {selectedStartTimes.length > 0 && (selectedDuration || customDuration) && (
                <Card className="bg-secondary border-none p-3 lg:p-4">
                  <div className="text-xs lg:text-sm text-muted-foreground mb-2">Preview</div>
                  {selectedStartTimes.length > 3 ? (
                    <div className="text-sm">
                      <span className="font-semibold">{selectedStartTimes.length} slots</span>
                      <span className="text-muted-foreground ml-2">
                        from {selectedStartTimes.sort()[0]} to {selectedStartTimes.sort()[selectedStartTimes.length - 1]}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedStartTimes.sort().map((time) => {
                        const [hours, minutes] = time.split(':').map(Number);
                        const duration = selectedDuration || parseInt(customDuration);
                        const endMinutes = minutes + duration;
                        const endHours = hours + Math.floor(endMinutes / 60);
                        const finalMinutes = endMinutes % 60;
                        const endTime = `${endHours}:${finalMinutes.toString().padStart(2, '0')}`;
                        
                        return (
                          <div key={time} className="text-sm">
                            {appointmentName.trim() && (
                              <Badge variant="secondary" className="mb-1 mr-2 text-xs">
                                {appointmentName.trim()}
                              </Badge>
                            )}
                            <span className="font-semibold">{time} - {endTime}</span>
                            <span className="text-muted-foreground ml-2">
                              ({duration} min)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              )}
            </div>
          </div>
        </Card>

        {/* Sticky Submit Button */}
        <div className="fixed bottom-16 left-0 right-0 p-4 bg-background border-t lg:static lg:border-t-0 lg:p-0 lg:mt-0">
          <div className="max-w-2xl mx-auto">
            <Button 
              onClick={handleAddSlots} 
              size="lg" 
              className="w-full"
              disabled={loading || !((selectedDuration || customDuration) && selectedStartTimes.length > 0)}
            >
              {loading ? "Adding..." : `Add ${selectedStartTimes.length || 0} Opening${selectedStartTimes.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </div>
    </MerchantLayout>
  );
};

export default AddAvailability;
