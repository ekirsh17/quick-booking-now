import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Bell } from "lucide-react";

const ConsumerNotify = () => {
  const { businessId } = useParams();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [timeRange, setTimeRange] = useState("today");
  const [saveInfo, setSaveInfo] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  // Mock business data
  const businessName = "Evan's Barbershop";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // TODO: Submit to backend when Cloud is enabled
    console.log({ businessId, name, phone, timeRange, saveInfo });
    
    setSubmitted(true);
    toast({
      title: "You're on the list!",
      description: "We'll text you if an opening appears.",
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">{businessName}</h1>
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

          <Button type="submit" className="w-full" size="lg">
            Notify Me
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-6">
          By submitting, you agree to receive SMS notifications. Reply STOP to opt out anytime.
        </p>
      </Card>
    </div>
  );
};

export default ConsumerNotify;
