import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Bell, CalendarIcon, Phone, MapPin, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ConsumerLayout } from "@/components/consumer/ConsumerLayout";
import { ConsumerAuthSection } from "@/components/consumer/ConsumerAuthSection";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Session } from "@supabase/supabase-js";

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
  const [merchantInfo, setMerchantInfo] = useState({
    businessName: "Business",
    phone: "",
    address: "",
    bookingUrl: ""
  });
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [consumerData, setConsumerData] = useState<{ name: string; phone: string } | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const isGuestRef = useRef(false);
  const [isAuthFlowActive, setIsAuthFlowActive] = useState(false);

  useEffect(() => {
    const fetchBusinessInfo = async () => {
      if (!businessId) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('business_name, phone, address, booking_url')
        .eq('id', businessId)
        .maybeSingle();
      
      if (data) {
        setMerchantInfo({
          businessName: data.business_name,
          phone: data.phone || "",
          address: data.address || "",
          bookingUrl: data.booking_url || ""
        });
      }
    };
    
    fetchBusinessInfo();
  }, [businessId]);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadConsumerData(session.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user && !isGuestRef.current) {
        setTimeout(() => loadConsumerData(session.user.id), 0);
      } else if (!session?.user) {
        setConsumerData(null);
        setIsGuest(false);
        isGuestRef.current = false;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadConsumerData = async (userId: string) => {
    const { data } = await supabase
      .from('consumers')
      .select('name, phone')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (data) {
      setConsumerData(data);
      setName(data.name);
      setPhone(data.phone);
    }
  };

  const handleContinueAsGuest = () => {
    setIsGuest(true);
    isGuestRef.current = true;
    setName("");
    setPhone("");
    setIsAuthFlowActive(false);
  };

  const handleAuthSuccess = (userData: { name: string; phone: string }) => {
    setName(userData.name);
    setPhone(userData.phone);
    setIsAuthFlowActive(false);
  };

  const handleAuthCancel = () => {
    setIsAuthFlowActive(false);
  };

  const handleStartAuth = () => {
    setIsAuthFlowActive(true);
  };

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
      let consumerId: string;

      // For authenticated users, find or create consumer by user_id
      if (session?.user) {
        const { data: existingConsumer } = await supabase
          .from('consumers')
          .select('id')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (existingConsumer) {
          // Use existing consumer, update their info
          const { error: updateError } = await supabase
            .from('consumers')
            .update({ name, phone, saved_info: saveInfo })
            .eq('id', existingConsumer.id);
          
          if (updateError) throw updateError;
          consumerId = existingConsumer.id;
        } else {
          // Create new consumer with user_id
          const { data: newConsumer, error: insertError } = await supabase
            .from('consumers')
            .insert({ name, phone, saved_info: saveInfo, user_id: session.user.id })
            .select('id')
            .single();
          
          if (insertError) throw insertError;
          consumerId = newConsumer.id;
        }
      } else {
        // For non-authenticated users, try to find by phone or create new
        const { data: existingConsumer } = await supabase
          .from('consumers')
          .select('id')
          .eq('phone', phone)
          .is('user_id', null)
          .maybeSingle();

        if (existingConsumer) {
          // Update existing guest consumer
          const { error: updateError } = await supabase
            .from('consumers')
            .update({ name, saved_info: saveInfo })
            .eq('id', existingConsumer.id);
          
          if (updateError) throw updateError;
          consumerId = existingConsumer.id;
        } else {
          // Create new guest consumer
          const { data: newConsumer, error: insertError } = await supabase
            .from('consumers')
            .insert({ name, phone, saved_info: saveInfo })
            .select('id')
            .single();
          
          if (insertError) throw insertError;
          consumerId = newConsumer.id;
        }
      }
      
      // Create or update notify request (avoid duplicate error)
      const { error: notifyError } = await supabase
        .from('notify_requests')
        .upsert(
          { merchant_id: businessId, consumer_id: consumerId, time_range: timeRange },
          { onConflict: 'merchant_id,consumer_id' }
        );
      
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
      <ConsumerLayout businessName={merchantInfo.businessName}>
        <Card className="w-full p-8 text-center">
          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="w-8 h-8 text-success" />
          </div>
          <h1 className="text-2xl font-bold mb-2">🎉 You're all set!</h1>
          <p className="text-muted-foreground mb-6">
            We'll text you at <span className="font-medium text-foreground">{phone}</span> if an opening appears at {merchantInfo.businessName}.
          </p>
          <p className="text-sm text-muted-foreground">
            You can close this page now.
          </p>
        </Card>
      </ConsumerLayout>
    );
  }

  return (
    <ConsumerLayout businessName={merchantInfo.businessName}>
      <Card className="w-full p-8">
        {/* Merchant Business Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">{merchantInfo.businessName}</h1>
          <p className="text-muted-foreground">
            Get notified when last-minute openings appear
          </p>
        </div>

        {/* Merchant Contact Info - only if available */}
        {(merchantInfo.address || merchantInfo.bookingUrl) && (
          <Card className="bg-muted/50 p-4 mb-6">
            <div className="space-y-2.5 text-sm">
              {merchantInfo.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{merchantInfo.address}</span>
                </div>
              )}
              {merchantInfo.bookingUrl && (
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <a 
                    href={merchantInfo.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline text-foreground"
                  >
                    Visit Website
                  </a>
                </div>
              )}
            </div>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isAuthFlowActive && (
            <>
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
                  disabled={session && consumerData && !isGuest}
                  readOnly={session && consumerData && !isGuest}
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <PhoneInput
                  value={phone}
                  onChange={(value) => setPhone(value || "")}
                  placeholder="(555) 123-4567"
                  className="mt-1"
                  disabled={session && consumerData && !isGuest}
                />
              </div>
            </>
          )}

          {isAuthFlowActive && (
            <ConsumerAuthSection
              onAuthSuccess={handleAuthSuccess}
              onClearFields={handleContinueAsGuest}
              currentPhone={phone}
              onCancel={handleAuthCancel}
            />
          )}

          <div>
            <Collapsible open={isAvailabilityOpen} onOpenChange={setIsAvailabilityOpen}>
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">When are you available?</Label>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 p-0 h-auto">
                    <span className="text-sm font-medium">
                      {timeRange === "today" && "Today"}
                      {timeRange === "3-days" && "Next 3 Days"}
                      {timeRange === "5-days" && "Next 5 Days"}
                      {timeRange === "1-week" && "Next Week"}
                      {timeRange === "custom" && "Custom Range"}
                    </span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", isAvailabilityOpen && "rotate-180")} />
                  </Button>
                </CollapsibleTrigger>
              </div>
              
              <CollapsibleContent className="mt-3">
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={timeRange === "today" ? "default" : "outline"}
                      onClick={() => {
                        setTimeRange("today");
                        setIsAvailabilityOpen(false);
                      }}
                      className="w-full"
                    >
                      Today
                    </Button>
                    <Button
                      type="button"
                      variant={timeRange === "3-days" ? "default" : "outline"}
                      onClick={() => {
                        setTimeRange("3-days");
                        setIsAvailabilityOpen(false);
                      }}
                      className="w-full"
                    >
                      3 Days
                    </Button>
                    <Button
                      type="button"
                      variant={timeRange === "5-days" ? "default" : "outline"}
                      onClick={() => {
                        setTimeRange("5-days");
                        setIsAvailabilityOpen(false);
                      }}
                      className="w-full"
                    >
                      5 Days
                    </Button>
                    <Button
                      type="button"
                      variant={timeRange === "1-week" ? "default" : "outline"}
                      onClick={() => {
                        setTimeRange("1-week");
                        setIsAvailabilityOpen(false);
                      }}
                      className="w-full"
                    >
                      1 Week
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
              </CollapsibleContent>
            </Collapsible>
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

          {!session && (
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
                Remember me for faster notifications next time
              </label>
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Submitting..." : "Notify Me"}
          </Button>

          {/* Consumer Auth Section - show signed in status or auth options */}
          {!isAuthFlowActive && (
            <>
              {session && consumerData && !isGuest ? (
                <div className="flex items-center justify-between text-sm pt-2 px-1">
                  <p className="text-muted-foreground">
                    Signed in as <span className="font-medium text-foreground">{consumerData.name}</span>
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={handleContinueAsGuest}
                    className="h-auto p-0 text-sm"
                  >
                    Continue as guest
                  </Button>
                </div>
              ) : (
                <ConsumerAuthSection
                  onAuthSuccess={handleAuthSuccess}
                  onClearFields={handleContinueAsGuest}
                  currentPhone={phone}
                  onStartAuth={handleStartAuth}
                />
              )}
            </>
          )}
        </form>

        <p className="text-xs text-muted-foreground text-center mt-6">
          By submitting, you agree to receive SMS notifications. Reply STOP to opt out anytime.
        </p>
      </Card>
    </ConsumerLayout>
  );
};

export default ConsumerNotify;
