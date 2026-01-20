import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { BriefcaseBusiness, ChevronLeft, ChevronRight, AlertCircle, Users, CalendarRange } from 'lucide-react';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { BUSINESS_TYPE_OPTIONS, WEEKLY_APPOINTMENT_OPTIONS, TEAM_SIZE_OPTIONS } from '@/types/businessProfile';

const profileSchema = z.object({
  businessType: z.string().min(1, "Business type is required"),
  businessTypeOther: z.string().optional(),
  weeklyAppointments: z.string().min(1, "Weekly schedule is required"),
  teamSize: z.string().min(1, "Team size is required"),
}).refine((data) => {
  if (data.businessType === 'other') {
    return Boolean(data.businessTypeOther && data.businessTypeOther.trim().length > 0);
  }
  return true;
}, {
  message: "Please specify your business type",
  path: ['businessTypeOther'],
});

interface BusinessProfileStepProps {
  businessType: string;
  businessTypeOther: string;
  weeklyAppointments: string;
  teamSize: string;
  onBusinessTypeChange: (value: string) => void;
  onBusinessTypeOtherChange: (value: string) => void;
  onWeeklyAppointmentsChange: (value: string) => void;
  onTeamSizeChange: (value: string) => void;
  onContinue: () => void;
  onBack: () => void;
  isLoading?: boolean;
}

export function BusinessProfileStep({
  businessType,
  businessTypeOther,
  weeklyAppointments,
  teamSize,
  onBusinessTypeChange,
  onBusinessTypeOtherChange,
  onWeeklyAppointmentsChange,
  onTeamSizeChange,
  onContinue,
  onBack,
  isLoading = false,
}: BusinessProfileStepProps) {
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleBusinessTypeChange = (value: string) => {
    onBusinessTypeChange(value);
    if (value !== 'other') {
      onBusinessTypeOtherChange('');
    }
  };

  const handleContinue = () => {
    try {
      profileSchema.parse({
        businessType,
        businessTypeOther,
        weeklyAppointments,
        teamSize,
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

  const isValid = Boolean(
    businessType
      && weeklyAppointments
      && teamSize
      && (businessType !== 'other' || businessTypeOther.trim().length > 0)
  );

  return (
    <div className="flex flex-col px-2">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center animate-in fade-in-0 zoom-in-95 duration-300">
          <BriefcaseBusiness className="w-5 h-5 text-primary" />
        </div>
        <div className="animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-100">
          <h2 className="text-xl font-bold">Business profile</h2>
          <p className="text-sm text-muted-foreground">
            A few details so we can tailor your experience
          </p>
        </div>
      </div>

      <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 delay-150">
        <div>
          <Label className="text-sm font-medium">Business Type <span className="text-destructive">*</span></Label>
          <Select value={businessType} onValueChange={handleBusinessTypeChange}>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Select your business type" />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {businessType === 'other' && (
            <div className="mt-3">
              <Input
                value={businessTypeOther}
                onChange={(e) => onBusinessTypeOtherChange(e.target.value)}
                placeholder="Describe your business"
                maxLength={80}
              />
            </div>
          )}
          {errors.businessType && (
            <p className="text-sm text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.businessType}
            </p>
          )}
          {errors.businessTypeOther && (
            <p className="text-sm text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.businessTypeOther}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <CalendarRange className="w-4 h-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Weekly schedule <span className="text-destructive">*</span></Label>
          </div>
          <RadioGroup
            value={weeklyAppointments}
            onValueChange={onWeeklyAppointmentsChange}
            className="gap-3"
          >
            {WEEKLY_APPOINTMENT_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer",
                  weeklyAppointments === option.value
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-primary/40"
                )}
              >
                <RadioGroupItem value={option.value} />
                <span className="text-sm font-medium">{option.label}</span>
              </label>
            ))}
          </RadioGroup>
          {errors.weeklyAppointments && (
            <p className="text-sm text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.weeklyAppointments}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Team size <span className="text-destructive">*</span></Label>
          </div>
          <RadioGroup
            value={teamSize}
            onValueChange={onTeamSizeChange}
            className="gap-3"
          >
            {TEAM_SIZE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer",
                  teamSize === option.value
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-primary/40"
                )}
              >
                <RadioGroupItem value={option.value} />
                <span className="text-sm font-medium">{option.label}</span>
              </label>
            ))}
          </RadioGroup>
          {errors.teamSize && (
            <p className="text-sm text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.teamSize}
            </p>
          )}
        </div>
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
