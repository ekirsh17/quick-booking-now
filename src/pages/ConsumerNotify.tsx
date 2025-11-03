import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Check, Loader2 } from "lucide-react";
import { useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Bell, CalendarIcon, Phone, MapPin, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ConsumerLayout } from "@/components/consumer/ConsumerLayout";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Session } from "@supabase/supabase-js";
import debounce from "lodash/debounce";

const isValidUUID = (uuid: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const ConsumerNotify = () => {
  const { businessId } = useParams();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [timeRange, setTimeRange] = useState("today");
  const [businessError, setBusinessError] = useState<string | null>(null);
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
  const [phoneChecked, setPhoneChecked] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [isNameAutofilled, setIsNameAutofilled] = useState(false);
  const [originalGuestName, setOriginalGuestName] = useState<string | null>(null);
  
  // Rate limiting refs
  const phoneCheckAttempts = useRef(0);
  const lastPhoneCheckTime = useRef(0);

  useEffect(() => {
    const fetchBusinessInfo = async () => {
      if (!businessId) {
        setBusinessError("Invalid notification link");
        return;
      }

      if (!isValidUUID(businessId)) {
        setBusinessError("Invalid notification link. Please check the URL.");
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('business_name, phone, address, booking_url')
          .eq('id', businessId)
          .maybeSingle();
        
        if (error) {
          setBusinessError("Unable to load business information");
          return;
        }

        if (!data) {
          setBusinessError("Business not found. Please contact the business for a valid link.");
          return;
        }

        setMerchantInfo({
          businessName: data.business_name,
          phone: data.phone || "",
          address: data.address || "",
          bookingUrl: data.booking_url || ""
        });
      } catch (error) {
        setBusinessError("An error occurred loading business information");
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

  const handleContinueAsGuest = async () => {
    await supabase.auth.signOut();
    setIsGuest(true);
    isGuestRef.current = true;
    setSession(null);
    setConsumerData(null);
    setName("");
    setPhone("");
  };

  const handlePhoneBlur = useCallback(
    debounce(async () => {
      if (phoneChecked || !phone || phone.length < 10) return;
      
      // Rate limiting: max 5 checks per minute
      const now = Date.now();
      if (now - lastPhoneCheckTime.current < 60000) {
        phoneCheckAttempts.current++;
        if (phoneCheckAttempts.current > 5) {
          toast({
            title: "Too many attempts",
            description: "Please wait a moment before trying again.",
            variant: "destructive",
          });
          return;
        }
      } else {
        phoneCheckAttempts.current = 0;
      }
      lastPhoneCheckTime.current = now;
      
      setPhoneChecked(true);
      setIsCheckingPhone(true);
      
      try {
        // Check for ANY consumer with this phone (guest OR authenticated)
        const { data: existingConsumer } = await supabase
          .from('consumers')
          .select('id, name, user_id')
          .eq('phone', phone)
          .maybeSingle();
        
        if (existingConsumer) {
          if (existingConsumer.user_id) {
            // Has account - trigger OTP for security
            toast({
              title: "Account found",
              description: "We'll send you a code to verify it's you",
            });
            await supabase.functions.invoke('generate-otp', { body: { phone } });
            setShowOtpInput(true);
          } else {
            // Guest - auto-fill name with visual feedback
            setName(existingConsumer.name || "");
            setIsNameAutofilled(true);
            setOriginalGuestName(existingConsumer.name);
            toast({
              title: `Welcome back, ${existingConsumer.name}!`,
              description: "We've filled in your info. Feel free to update it.",
            });
          }
        }
      } catch (error) {
        console.error('Error checking phone:', error);
      } finally {
        setIsCheckingPhone(false);
      }
    }, 300),
    [phone, phoneChecked]
  );

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { phone, code: otpCode }
      });
      
      if (error || !data.success) throw new Error('Verification failed');
      
      await supabase.auth.setSession({
        access_token: data.accessToken,
        refresh_token: data.refreshToken,
      });
      
      const { data: consumer } = await supabase
        .from('consumers')
        .select('name')
        .eq('phone', phone)
        .single();
      
      if (consumer) setName(consumer.name);
      setShowOtpInput(false);
      
      toast({ title: "Signed in successfully" });
    } catch (error) {
      toast({ title: "Verification failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = (value: string | undefined) => {
    setPhone(value || "");
    if (showOtpInput) {
      setShowOtpInput(false);
      setOtpCode("");
      setPhoneChecked(false);
    }
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
          .select('id, user_id, name')
          .eq('phone', phone)
          .maybeSingle();

        if (existingConsumer) {
          if (existingConsumer.user_id) {
            // Authenticated account - must verify with OTP
            toast({
              title: "Account exists",
              description: "Please verify with the code sent to your phone.",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
          
          // Guest - update their info (they might have changed their name)
          consumerId = existingConsumer.id;
          
          // Detect if name changed
          const nameChanged = originalGuestName && 
                               name.toLowerCase() !== originalGuestName.toLowerCase();
          
          const { error: updateError } = await supabase
            .from('consumers')
            .update({ 
              name,
              saved_info: saveInfo // Respect their new preference
            })
            .eq('id', consumerId);
          
          if (updateError) throw updateError;
          
          // Show confirmation if name was updated
          if (nameChanged) {
            toast({
              title: "Profile updated",
              description: `We've updated your name from "${originalGuestName}" to "${name}"`,
            });
          }
        } else {
          // New consumer - create guest record
          const { data: newConsumer, error: insertError } = await supabase
            .from('consumers')
            .insert({
              name,
              phone,
              saved_info: saveInfo
            })
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
      
      // Show success toast with optional account creation CTA
      if (!session && saveInfo) {
        toast({
          title: "Success! You're on the list",
          description: "We'll text you if an opening appears.",
        });
      } else {
        toast({
          title: "You're on the list!",
          description: "We'll text you if an opening appears.",
        });
      }
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

  if (businessError) {
    return (
      <ConsumerLayout businessName="NotifyMe">
        <Card className="w-full p-8 text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Unable to Load Page</h1>
          <p className="text-muted-foreground mb-6">
            {businessError}
          </p>
          <p className="text-sm text-muted-foreground">
            Please contact the business for a valid notification link.
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
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <div className="relative mt-1">
              <PhoneInput
                value={phone}
                onChange={handlePhoneChange}
                onBlur={handlePhoneBlur}
                placeholder="(555) 123-4567"
                disabled={session && consumerData && !isGuest}
              />
              {isCheckingPhone && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </div>

          {showOtpInput && (
            <div className="space-y-2">
              <Label htmlFor="otp">Enter code from SMS</Label>
              <div className="flex gap-2">
                <InputOTP
                  maxLength={6}
                  value={otpCode}
                  onChange={setOtpCode}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                <Button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={otpCode.length !== 6 || loading}
                >
                  Verify
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">
              Your Name
            </Label>
            <div className="relative">
              {isNameAutofilled && (
                <Check className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
              )}
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setIsNameAutofilled(false);
                }}
                required
                className={cn(
                  isNameAutofilled && "pl-10 bg-green-50/50 dark:bg-green-900/20"
                )}
                disabled={session && consumerData && !isGuest}
                readOnly={session && consumerData && !isGuest}
              />
            </div>
            {isNameAutofilled && (
              <p className="text-xs text-muted-foreground mt-1">
                We remembered your info from last time
              </p>
            )}
          </div>

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

          {!session && !showOtpInput && !isNameAutofilled && (
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
                Save my info for next time
              </label>
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={loading || showOtpInput}>
            {loading ? "Submitting..." : "Notify Me"}
          </Button>

          {session && consumerData && !isGuest && (
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
