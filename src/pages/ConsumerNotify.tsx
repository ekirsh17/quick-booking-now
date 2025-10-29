import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ConsumerLayout } from "@/components/consumer/ConsumerLayout";

const ConsumerNotify = () => {
  const { businessId } = useParams();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [timeRange, setTimeRange] = useState("today");
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
            <select
              id="timeRange"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="today">Today</option>
              <option value="this-week">This Week</option>
              <option value="next-week">Next Week</option>
              <option value="anytime">Anytime</option>
            </select>
          </div>

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
