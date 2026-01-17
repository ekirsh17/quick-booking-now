import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { z } from 'zod';

const businessDetailsSchema = z.object({
  businessName: z.string().min(1, "Business name is required").max(100, "Business name is too long"),
  email: z.string().email("Valid email is required"),
  address: z.string().max(200, "Address is too long").optional(),
  smsConsent: z.literal(true, {
    errorMap: () => ({ message: "You must consent to receive SMS messages to use NotifyMe" }),
  }),
});

interface BusinessDetailsStepProps {
  businessName: string;
  email: string;
  address: string;
  smsConsent: boolean;
  onBusinessNameChange: (name: string) => void;
  onEmailChange: (email: string) => void;
  onAddressChange: (address: string) => void;
  onSmsConsentChange: (consent: boolean) => void;
  onContinue: () => void;
  onBack: () => void;
  isLoading?: boolean;
}

export function BusinessDetailsStep({
  businessName,
  email,
  address,
  smsConsent,
  onBusinessNameChange,
  onEmailChange,
  onAddressChange,
  onSmsConsentChange,
  onContinue,
  onBack,
  isLoading = false,
}: BusinessDetailsStepProps) {
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});

  // Validate on change after field has been touched
  useEffect(() => {
    if (touched.businessName && !businessName.trim()) {
      setErrors(prev => ({ ...prev, businessName: "Business name is required" }));
    } else if (touched.businessName) {
      setErrors(prev => ({ ...prev, businessName: "" }));
    }
  }, [businessName, touched.businessName]);

  useEffect(() => {
    if (touched.email) {
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
      setErrors(prev => ({ ...prev, email: isValid ? "" : "Valid email is required" }));
    }
  }, [email, touched.email]);

  const handleContinue = () => {
    try {
      businessDetailsSchema.parse({ businessName, email, address, smsConsent });
      setErrors({});
      onContinue();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { [key: string]: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    }
  };

  const isValid = businessName.trim().length > 0
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    && smsConsent;

  return (
    <div className="flex flex-col px-2">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center animate-in fade-in-0 zoom-in-95 duration-300">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div className="animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-100">
          <h2 className="text-xl font-bold">Tell us about your business</h2>
          <p className="text-sm text-muted-foreground">
            This helps us personalize your experience
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 delay-150">
        {/* Business Name */}
        <div>
          <Label htmlFor="business-name" className="text-sm font-medium">
            Business Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="business-name"
            value={businessName}
            onChange={(e) => onBusinessNameChange(e.target.value)}
            onBlur={() => setTouched(prev => ({ ...prev, businessName: true }))}
            placeholder="e.g., Sarah's Salon"
            className="mt-1.5"
            maxLength={100}
          />
          {errors.businessName && (
            <p className="text-sm text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.businessName}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <Label htmlFor="email" className="text-sm font-medium">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
            placeholder="you@business.com"
            className="mt-1.5"
          />
          {errors.email && (
            <p className="text-sm text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.email}
            </p>
          )}
        </div>

        {/* Business Address */}
        <div>
          <Label htmlFor="address" className="text-sm font-medium">
            Business Address <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Input
            id="address"
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            placeholder="123 Main St, City, State"
            className="mt-1.5"
            maxLength={200}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Helps customers find you when booking
          </p>
        </div>

        {/* SMS Consent */}
        <div className="p-4 bg-muted/50 rounded-lg border border-muted animate-in fade-in-0 duration-300 delay-200">
          <div className="flex items-start gap-3">
            <Checkbox
              id="sms-consent"
              checked={smsConsent}
              onCheckedChange={(checked) => onSmsConsentChange(checked === true)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label 
                htmlFor="sms-consent" 
                className="text-sm leading-relaxed cursor-pointer font-normal"
              >
                I agree to receive SMS notifications about appointment availability and service updates. Message and data rates may apply. Reply STOP to opt out at any time.
              </Label>
              {errors.smsConsent && (
                <p className="text-sm text-destructive mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.smsConsent}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Actions */}
      <div className="flex gap-3 mt-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-300 delay-300">
        <Button 
          onClick={onBack} 
          variant="outline"
          className="flex-1"
          disabled={isLoading}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <Button 
          onClick={handleContinue}
          className="flex-1"
          disabled={!isValid || isLoading}
        >
          {isLoading ? "Saving..." : "Continue"}
          {!isLoading && <ChevronRight className="w-4 h-4 ml-1" />}
        </Button>
      </div>
    </div>
  );
}
