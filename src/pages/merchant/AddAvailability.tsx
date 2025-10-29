import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Clock } from "lucide-react";
import MerchantLayout from "@/components/merchant/MerchantLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const AddAvailability = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [customDuration, setCustomDuration] = useState("");
  const [selectedStartTimes, setSelectedStartTimes] = useState<string[]>([]);
  const [appointmentName, setAppointmentName] = useState("");
  const [savedNames, setSavedNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  const presetDurations = [15, 20, 25, 30, 45, 60];
  const smartStartTimes = [
    "9:00", "9:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "1:00", "1:30", "2:00", "2:30",
    "3:00", "3:30", "4:00", "4:30", "5:00"
  ];

  // Load saved appointment names from localStorage
  useState(() => {
    const saved = localStorage.getItem('appointmentNames');
    if (saved) {
      setSavedNames(JSON.parse(saved));
    }
  });

  const toggleStartTime = (time: string) => {
    setSelectedStartTimes(prev => 
      prev.includes(time) 
        ? prev.filter(t => t !== time)
        : [...prev, time]
    );
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
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Add Opening</h1>
          <p className="text-muted-foreground">
            Select when you have an available appointment slot
          </p>
        </div>

        <Card className="p-8">
          <div className="space-y-8">
            {/* Duration Selection */}
            <div>
              <Label className="text-lg font-semibold mb-4 block">
                Appointment Duration
              </Label>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
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

            {/* Appointment Name (Optional) */}
            <div>
              <Label className="text-lg font-semibold mb-4 block">
                Appointment Name (Optional)
              </Label>
              <div className="space-y-3">
                <Input
                  type="text"
                  placeholder="e.g., Haircut, Consultation, Massage"
                  value={appointmentName}
                  onChange={(e) => setAppointmentName(e.target.value)}
                  list="saved-names"
                />
                {savedNames.length > 0 && (
                  <datalist id="saved-names">
                    {savedNames.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                )}
                {savedNames.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {savedNames.map((name) => (
                      <Button
                        key={name}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAppointmentName(name)}
                      >
                        {name}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Mr. Start Times - Multiple Selection */}
            <div>
              <Label className="text-lg font-semibold mb-4 block">
                <Clock className="w-5 h-5 inline mr-2" />
                Start Times (Select Multiple)
              </Label>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                {smartStartTimes.map((time) => (
                  <Button
                    key={time}
                    variant={selectedStartTimes.includes(time) ? "default" : "outline"}
                    onClick={() => toggleStartTime(time)}
                    className="h-14"
                  >
                    {time}
                  </Button>
                ))}
              </div>
              {selectedStartTimes.length > 0 && (
                <div className="mt-3 text-sm text-muted-foreground">
                  {selectedStartTimes.length} time{selectedStartTimes.length > 1 ? 's' : ''} selected
                </div>
              )}
            </div>

            {/* Preview */}
            {selectedStartTimes.length > 0 && (selectedDuration || customDuration) && (
              <Card className="bg-secondary border-none p-4">
                <div className="text-sm text-muted-foreground mb-2">Preview</div>
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
                        <span className="font-semibold">{time} - {endTime}</span>
                        <span className="text-muted-foreground ml-2">
                          ({duration} min)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            <Button 
              onClick={handleAddSlots} 
              size="lg" 
              className="w-full"
              disabled={loading}
            >
              {loading ? "Adding Slots..." : `Add ${selectedStartTimes.length || 0} Opening${selectedStartTimes.length !== 1 ? 's' : ''} & Notify`}
            </Button>
          </div>
        </Card>
      </div>
    </MerchantLayout>
  );
};

export default AddAvailability;
