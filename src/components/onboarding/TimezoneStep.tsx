import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TIMEZONE_OPTIONS } from '@/types/onboarding';
import { Globe, ChevronLeft, ChevronRight } from 'lucide-react';

interface TimezoneStepProps {
  timezone: string;
  onTimezoneChange: (tz: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function TimezoneStep({ 
  timezone, 
  onTimezoneChange, 
  onContinue, 
  onBack 
}: TimezoneStepProps) {
  const currentTimezone = TIMEZONE_OPTIONS.find(tz => tz.value === timezone);
  
  return (
    <div className="flex flex-col px-2">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Globe className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Confirm your timezone</h2>
          <p className="text-sm text-muted-foreground">
            Ensures appointments show correct times
          </p>
        </div>
      </div>
      
      {/* Detected timezone display */}
      <div className="bg-muted/50 rounded-lg p-4 mb-6 animate-in fade-in-0 duration-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Detected timezone</p>
            <p className="font-medium">{currentTimezone?.label || timezone}</p>
          </div>
          <div className="text-2xl">🕐</div>
        </div>
      </div>
      
      {/* Timezone selector */}
      <div className="space-y-3 mb-8 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 delay-100">
        <Label htmlFor="timezone">Change timezone</Label>
        <Select value={timezone} onValueChange={onTimezoneChange}>
          <SelectTrigger id="timezone" className="w-full">
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
        <p className="text-xs text-muted-foreground">
          You can change this later in Settings
        </p>
      </div>
      
      {/* Actions */}
      <div className="flex gap-3 mt-auto animate-in fade-in-0 slide-in-from-bottom-4 duration-300 delay-200">
        <Button 
          onClick={onBack} 
          variant="outline"
          className="flex-1"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <Button 
          onClick={onContinue}
          className="flex-1"
        >
          Continue
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}


