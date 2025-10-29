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
  const [selectedStartTime, setSelectedStartTime] = useState("");
  const [loading, setLoading] = useState(false);
  
  const presetDurations = [15, 20, 25, 30, 45, 60];
  const smartStartTimes = ["2:00", "2:15", "2:30", "2:45", "3:00", "3:15", "3:30", "3:45"];

  const handleAddSlot = async () => {
    const duration = selectedDuration || parseInt(customDuration);
    
    if (!duration || !selectedStartTime) {
      toast({
        title: "Missing information",
        description: "Please select a duration and start time.",
        variant: "destructive",
      });
      return;
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
      // Parse start time and calculate end time
      const now = new Date();
      const [hours, minutes] = selectedStartTime.split(':').map(Number);
      const startTime = new Date(now);
      startTime.setHours(hours, minutes, 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + duration);

      // Create slot
      const { error } = await supabase
        .from('slots')
        .insert({
          merchant_id: user.id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          duration_minutes: duration,
          status: 'open',
        });

      if (error) throw error;

      toast({
        title: "✅ Slot Added",
        description: `Notifying customers about ${selectedStartTime} opening (${duration} min)`,
      });
      
      navigate("/merchant/dashboard");
    } catch (error: any) {
      console.error('Error adding slot:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add slot",
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

            {/* Smart Start Times */}
            <div>
              <Label className="text-lg font-semibold mb-4 block">
                <Clock className="w-5 h-5 inline mr-2" />
                Start Time
              </Label>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                {smartStartTimes.map((time) => (
                  <Button
                    key={time}
                    variant={selectedStartTime === time ? "default" : "outline"}
                    onClick={() => setSelectedStartTime(time)}
                    className="h-14"
                  >
                    {time}
                  </Button>
                ))}
              </div>
              
              <div className="mt-4">
                <Input
                  type="time"
                  value={selectedStartTime}
                  onChange={(e) => setSelectedStartTime(e.target.value)}
                  className="max-w-xs"
                />
              </div>
            </div>

            {/* Preview */}
            {selectedStartTime && (selectedDuration || customDuration) && (
              <Card className="bg-secondary border-none p-4">
                <div className="text-sm text-muted-foreground mb-1">Preview</div>
                <div className="text-lg font-semibold">
                  {selectedStartTime} - {
                    (() => {
                      const [hours, minutes] = selectedStartTime.split(':').map(Number);
                      const duration = selectedDuration || parseInt(customDuration);
                      const endMinutes = minutes + duration;
                      const endHours = hours + Math.floor(endMinutes / 60);
                      const finalMinutes = endMinutes % 60;
                      return `${endHours}:${finalMinutes.toString().padStart(2, '0')}`;
                    })()
                  }
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedDuration || customDuration} minute appointment
                </div>
              </Card>
            )}

            <Button 
              onClick={handleAddSlot} 
              size="lg" 
              className="w-full"
              disabled={loading}
            >
              {loading ? "Adding Slot..." : "Confirm & Notify Customers"}
            </Button>
          </div>
        </Card>
      </div>
    </MerchantLayout>
  );
};

export default AddAvailability;
