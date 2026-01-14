import { useState, useEffect } from "react";
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
import { Bell, CalendarIcon, MapPin, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ConsumerLayout } from "@/components/consumer/ConsumerLayout";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useConsumerAuth } from "@/hooks/useConsumerAuth";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { normalizePhoneToE164 } from "@/utils/phoneValidation";

// Confetti piece component - simple circles and squares
const ConfettiPiece = ({ 
  index, 
  color, 
  startX 
}: { 
  index: number; 
  color: string; 
  startX: number;
}) => {
  const isCircle = index % 2 === 0;
  const size = 5 + Math.random() * 5;
  const rotation = Math.random() * 360;
  const xDrift = (Math.random() - 0.5) * 180;
  const delay = index * 0.015;
  
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: `${startX}%`,
        top: '35%',
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: isCircle ? '50%' : '2px',
      }}
      initial={{ y: 0, x: 0, opacity: 1, scale: 0, rotate: rotation }}
      animate={{ 
        y: [0, -120 - Math.random() * 80],
        x: [0, xDrift],
        opacity: [1, 1, 0],
        scale: [0, 1, 0.6],
        rotate: [rotation, rotation + (Math.random() > 0.5 ? 360 : -360)]
      }}
      transition={{ 
        duration: 1 + Math.random() * 0.3,
        delay,
        ease: [0.22, 1, 0.36, 1]
      }}
    />
  );
};

// Success state component - matches app design language
const SuccessState = ({ phone }: { phone: string }) => {
  // Use primary color variants for confetti to match app theme
  const confettiColors = ['#3b82f6', '#60a5fa', '#22c55e', '#4ade80', '#a855f7', '#c084fc'];
  const confettiCount = 24;
  
  const formattedPhone = phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');

  return (
    <Card className="w-full p-8 text-center overflow-hidden relative">
      {/* Confetti burst */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: confettiCount }).map((_, i) => (
          <ConfettiPiece
            key={i}
            index={i}
            color={confettiColors[i % confettiColors.length]}
            startX={30 + Math.random() * 40}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Checkmark icon - using Lucide like rest of app */}
        <motion.div 
          className="mb-6 flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ 
            type: "spring",
            stiffness: 200,
            damping: 15,
            delay: 0.1
          }}
        >
          <CheckCircle2 className="w-16 h-16 text-green-500" />
        </motion.div>

        {/* Title */}
        <motion.h1
          className="text-2xl font-bold mb-3"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          You're on the list!
        </motion.h1>

        {/* Subtitle with phone */}
        <motion.p
          className="text-muted-foreground"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          We'll text you at{" "}
          <span className="font-semibold text-foreground">{formattedPhone}</span>
          <br />
          when something opens up.
        </motion.p>
      </div>
    </Card>
  );
};

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
    bookingUrl: "",
    timeZone: ""
  });
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);
  
  // Use unified consumer authentication hook first
  const { state: authState, actions: authActions, otpCode, setOtpCode } = useConsumerAuth({
    phone,
    onNameAutofill: (autofilledName) => setName(autofilledName),
    authStrategy: 'none', // NotifyMe flow never requires OTP
  });

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
          .select('business_name, phone, address, booking_url, time_zone')
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
          bookingUrl: data.booking_url || "",
          timeZone: data.time_zone || ""
        });
      } catch (error) {
        setBusinessError("An error occurred loading business information");
      }
    };
    
    fetchBusinessInfo();
  }, [businessId]);

  // Load consumer data when authenticated
  useEffect(() => {
    if (authState.session?.user && authState.consumerData) {
      setName(authState.consumerData.name);
      setPhone(authState.consumerData.phone);
    }
  }, [authState.session, authState.consumerData]);

  const handlePhoneChange = (value: string | undefined) => {
    setPhone(value || "");
    authActions.handlePhoneChange(value);
  };

  const handleVerifyOtp = async () => {
    const success = await authActions.handleVerifyOtp(otpCode);
    if (!success) {
      setOtpCode("");
    }
  };

  const formatDateInTimeZone = (date: Date, timeZone: string) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value || '0000';
    const month = parts.find((part) => part.type === 'month')?.value || '01';
    const day = parts.find((part) => part.type === 'day')?.value || '01';
    return `${year}-${month}-${day}`;
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
      // Normalize phone to E.164 format before database operations
      let normalizedPhone: string;
      try {
        normalizedPhone = normalizePhoneToE164(phone);
      } catch (normalizationError: any) {
        toast({
          title: "Invalid phone number",
          description: normalizationError.message || "Please enter a valid phone number",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      let consumerId: string;

      // For authenticated users, find or create consumer by user_id
      if (authState.session?.user) {
        const { data: existingConsumer } = await supabase
          .from('consumers')
          .select('id')
          .eq('user_id', authState.session.user.id)
          .maybeSingle();

        if (existingConsumer) {
          // Use existing consumer, update their info
          const { error: updateError } = await supabase
            .from('consumers')
            .update({ name, phone: normalizedPhone, saved_info: saveInfo })
            .eq('id', existingConsumer.id);
          
          if (updateError) throw updateError;
          consumerId = existingConsumer.id;
        } else {
          // Create new consumer with user_id
          const { data: newConsumer, error: insertError } = await supabase
            .from('consumers')
            .insert({ name, phone: normalizedPhone, saved_info: saveInfo, user_id: authState.session.user.id })
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
          .eq('phone', normalizedPhone)
          .maybeSingle();

        if (existingConsumer) {
          consumerId = existingConsumer.id;

          // Guest or OTP-not-required flow - update their info (they might have changed their name)
          const { error: updateError } = await supabase
            .from('consumers')
            .update({ 
              name,
              saved_info: saveInfo
            })
            .eq('id', consumerId);
          
          if (updateError) throw updateError;
        } else {
          // New consumer - create guest record
          const { data: newConsumer, error: insertError } = await supabase
            .from('consumers')
            .insert({
              name,
              phone: normalizedPhone,
              saved_info: saveInfo
            })
            .select('id')
            .single();
          
          if (insertError) throw insertError;
          consumerId = newConsumer.id;
        }
      }
      
      const timeZone = merchantInfo.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      const timeRangeToStore =
        timeRange === "today" ? formatDateInTimeZone(new Date(), timeZone) : timeRange;

      // Check for existing notify request to prevent duplicates
      const { data: existingRequest } = await supabase
        .from('notify_requests')
        .select('id, time_range')
        .eq('merchant_id', businessId)
        .eq('consumer_id', consumerId)
        .maybeSingle();

      if (existingRequest) {
        // Update existing request if time_range changed
        if (existingRequest.time_range !== timeRangeToStore) {
          const { error: updateError } = await supabase
            .from('notify_requests')
            .update({ time_range: timeRangeToStore })
            .eq('id', existingRequest.id);
          
          if (updateError) throw updateError;
          
          setSubmitted(true);
          toast({
            title: "Preferences updated!",
            description: "We've updated your notification preferences.",
          });
          return;
        } else {
          setSubmitted(true);
          toast({
            title: "Already subscribed!",
            description: "You're already on the notification list.",
          });
          return;
        }
      } else {
        // Create new notify request
        const { error: notifyError } = await supabase
          .from('notify_requests')
          .insert({ merchant_id: businessId, consumer_id: consumerId, time_range: timeRangeToStore });
        
        if (notifyError) throw notifyError;
      }
      
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
        <SuccessState phone={phone} />
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
        {/* Hero: Value Proposition First */}
        <div className="text-center mb-8">
          {/* Value proposition as hero */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2">
              Get first dibs on cancellations
            </h1>
            <p className="text-muted-foreground">
              When someone cancels, you'll be the first to know.
            </p>
          </div>
          
          {/* Merchant info as secondary context */}
          <div className="pt-4 border-t">
            <p className="text-lg font-semibold mb-2">{merchantInfo.businessName}</p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
              {merchantInfo.address && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{merchantInfo.address}</span>
                </div>
              )}
              {merchantInfo.bookingUrl && (
                <a 
                  href={merchantInfo.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Website</span>
                </a>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <div className="relative mt-1">
              <PhoneInput
                value={phone}
                onChange={handlePhoneChange}
                onBlur={authActions.handlePhoneBlur}
                placeholder="(555) 123-4567"
                disabled={authState.session && authState.consumerData && !authState.isGuest}
              />
              {authState.isCheckingPhone && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </div>

          {authState.showOtpInput && (
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

          {authState.showNameInput && (
            <div className="space-y-2">
            <Label htmlFor="name">
              Your Name
            </Label>
            <div className="relative">
              {authState.isNameAutofilled && (
                <Check className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
              )}
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                }}
                required
                className={cn(
                  authState.isNameAutofilled && "pl-10 bg-green-50/50 dark:bg-green-900/20"
                )}
                disabled={authState.session && authState.consumerData && !authState.isGuest}
                readOnly={authState.session && authState.consumerData && !authState.isGuest}
              />
            </div>
            {authState.isNameAutofilled && (
              <p className="text-xs text-muted-foreground mt-1">
                We remembered your info from last time
              </p>
            )}
            </div>
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

          {!authState.session && !authState.showOtpInput && !authState.isNameAutofilled && (
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

          <Button 
            type="submit" 
            className="w-full font-semibold" 
            size="lg" 
            disabled={loading || authState.showOtpInput}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Bell className="w-4 h-4 mr-2" />
                Notify Me
              </>
            )}
          </Button>

          {authState.session && authState.consumerData && !authState.isGuest && (
            <div className="flex items-center justify-between text-sm pt-2 px-1">
              <p className="text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{authState.consumerData.name}</span>
              </p>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={authActions.handleContinueAsGuest}
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
