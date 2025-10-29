import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Bell, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ConsumerLayout } from "@/components/consumer/ConsumerLayout";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const ConsumerNotify = () => {
  const { businessId } = useParams();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [timeRange, setTimeRange] = useState("today");
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [customStartTime, setCustomStartTime] = useState("");
  const [customEndTime, setCustomEndTime] = useState("");
  const [saveInfo, setSaveInfo] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [businessName, setBusinessName] = useState("Business");

  useEffect(() => {
    const fetchBusinessInfo = async () => {
      if (!businessId) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('business_name')
        .eq('id', businessId)
        .maybeSingle();
      
      if (data) {
        setBusinessName(data.business_name);
      }
    };
    
    fetchBusinessInfo();
  }, [businessId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!businessId) {
      toast({
        title: "Error",
        description: "Invalid business ID",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Create or get consumer
      const { data: consumer, error: consumerError } = await supabase
        .from('consumers')
        .insert({ name, phone, saved_info: saveInfo })
        .select()
        .single();
      
      if (consumerError) throw consumerError;
      
      // Create notify request
      const { error: notifyError } = await supabase
        .from('notify_requests')
        .insert({
          merchant_id: businessId,
          consumer_id: consumer.id,
          time_range: timeRange,
        });
      
      if (notifyError) throw notifyError;
      
      setSubmitted(true);
      toast({
        title: "You're on the list!",
        description: "We'll text you if an opening appears.",
      });
    } catch (error: any) {
      console.error('Error submitting:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <ConsumerLayout businessName={businessName}>
        <Card className="w-full p-8 text-center">
          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="w-8 h-8 text-success" />
          </div>
          <h1 className="text-2xl font-bold mb-2">🎉 You're all set!</h1>
          <p className="text-muted-foreground mb-6">
            We'll text you at <span className="font-medium text-foreground">{phone}</span> if an opening appears at {businessName}.
          </p>
          <p className="text-sm text-muted-foreground">
            You can close this page now.
          </p>
        </Card>
      </ConsumerLayout>
    );
  }

  return (
    <ConsumerLayout businessName={businessName}>
      <Card className="w-full p-8">
        <div className="text-center mb-6">
          <p className="text-muted-foreground">
            Get notified when last-minute openings appear
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Your Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="timeRange">When are you available?</Label>
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={timeRange === "today" ? "default" : "outline"}
                  onClick={() => setTimeRange("today")}
                  className="w-full"
                >
                  Today
                </Button>
                <Button
                  type="button"
                  variant={timeRange === "3-days" ? "default" : "outline"}
                  onClick={() => setTimeRange("3-days")}
                  className="w-full"
                >
                  3 Days
                </Button>
                <Button
                  type="button"
                  variant={timeRange === "5-days" ? "default" : "outline"}
                  onClick={() => setTimeRange("5-days")}
                  className="w-full"
                >
                  5 Days
                </Button>
                <Button
                  type="button"
                  variant={timeRange === "1-week" ? "default" : "outline"}
                  onClick={() => setTimeRange("1-week")}
                  className="w-full"
                >
                  1 Week
                </Button>
                <Button
                  type="button"
                  variant={timeRange === "next-week" ? "default" : "outline"}
                  onClick={() => setTimeRange("next-week")}
                  className="w-full col-span-2"
                >
                  Following Week
                </Button>
              </div>
              <Button
                type="button"
                variant={timeRange === "custom" ? "default" : "outline"}
                onClick={() => setTimeRange("custom")}
                className="w-full"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                Custom Date Range
              </Button>
            </div>
          </div>

          {timeRange === "custom" && (
            <div className="space-y-4 p-4 border rounded-lg bg-secondary/50">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal mt-1",
                          !customStartDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customStartDate ? format(customStartDate, "PPP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customStartDate}
                        onSelect={setCustomStartDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal mt-1",
                          !customEndDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customEndDate ? format(customEndDate, "PPP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customEndDate}
                        onSelect={setCustomEndDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={customStartTime}
                    onChange={(e) => setCustomStartTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={customEndTime}
                    onChange={(e) => setCustomEndTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="save-info"
              checked={saveInfo}
              onCheckedChange={(checked) => setSaveInfo(checked as boolean)}
            />
            <label
              htmlFor="save-info"
              className="text-sm text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Save my info for faster notifications next time
            </label>
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Submitting..." : "Notify Me"}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-6">
          By submitting, you agree to receive SMS notifications. Reply STOP to opt out anytime.
        </p>
      </Card>
    </ConsumerLayout>
  );
};

export default ConsumerNotify;
