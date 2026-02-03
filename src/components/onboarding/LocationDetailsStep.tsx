import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import { TIMEZONE_OPTIONS } from '@/types/onboarding';

const locationSchema = z.object({
  locationName: z.string().min(1, "Location name is required").max(100, "Location name is too long"),
  locationAddress: z.string().max(200, "Address is too long").optional(),
  locationPhone: z.string().optional(),
  timezone: z.string().min(1, "Timezone is required"),
});

interface LocationDetailsStepProps {
  locationName: string;
  locationAddress: string;
  locationPhone: string;
  timezone: string;
  onLocationNameChange: (value: string) => void;
  onLocationAddressChange: (value: string) => void;
  onLocationPhoneChange: (value: string) => void;
  onTimezoneChange: (value: string) => void;
  onContinue: () => void;
  onBack: () => void;
  isLoading?: boolean;
}

export function LocationDetailsStep({
  locationName,
  locationAddress,
  locationPhone,
  timezone,
  onLocationNameChange,
  onLocationAddressChange,
  onLocationPhoneChange,
  onTimezoneChange,
  onContinue,
  onBack,
  isLoading = false,
}: LocationDetailsStepProps) {
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleContinue = () => {
    try {
      locationSchema.parse({
        locationName,
        locationAddress,
        locationPhone,
        timezone,
      });
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

  const isValid = Boolean(locationName.trim().length > 0 && timezone);

  return (
    <div className="flex flex-col px-2">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center animate-in fade-in-0 zoom-in-95 duration-300">
          <MapPin className="w-5 h-5 text-primary" />
        </div>
        <div className="animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-100">
          <h2 className="text-xl font-bold">Set your primary location</h2>
          <p className="text-sm text-muted-foreground">
            Use this for openings, notifications, and customer details
          </p>
        </div>
      </div>

      <div className="space-y-5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 delay-150">
        <div>
          <Label htmlFor="location-name" className="text-sm font-medium">
            Location Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="location-name"
            value={locationName}
            onChange={(e) => onLocationNameChange(e.target.value)}
            placeholder="e.g., Main Studio"
            className="mt-1.5"
            maxLength={100}
          />
          {errors.locationName && (
            <p className="text-sm text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.locationName}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="location-address" className="text-sm font-medium">
            Address <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Input
            id="location-address"
            value={locationAddress}
            onChange={(e) => onLocationAddressChange(e.target.value)}
            placeholder="123 Main St, City, State"
            className="mt-1.5"
            maxLength={200}
          />
          {errors.locationAddress && (
            <p className="text-sm text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.locationAddress}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="location-phone" className="text-sm font-medium">
            Phone <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <PhoneInput
            value={locationPhone}
            onChange={(value) => onLocationPhoneChange(value || '')}
            placeholder="(555) 123-4567"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="location-timezone" className="text-sm font-medium">
            Time Zone <span className="text-destructive">*</span>
          </Label>
          <Select value={timezone} onValueChange={onTimezoneChange}>
            <SelectTrigger id="location-timezone" className="mt-1.5">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_OPTIONS.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-muted-foreground">
          You can add more locations later in Settings.
        </p>
      </div>

      <div className="flex-1 min-h-4" />

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
