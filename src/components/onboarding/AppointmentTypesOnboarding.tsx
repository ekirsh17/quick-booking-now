import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppointmentPresets } from '@/hooks/useAppointmentPresets';
import { useDurationPresets } from '@/hooks/useDurationPresets';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, GripVertical, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppointmentTypesOnboardingProps {
  userId: string;
  onComplete: () => void;
}

const DEFAULT_TYPE_PRESETS = [
  'Consultation',
  'Follow-up',
  'New Client',
  'Existing Client',
];

const DEFAULT_DURATION_PRESETS = [
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: '1.5h', minutes: 90 },
  { label: '2h', minutes: 120 },
];

export const AppointmentTypesOnboarding = ({
  userId,
  onComplete,
}: AppointmentTypesOnboardingProps) => {
  const { presets, loading, createPreset, deletePreset } = useAppointmentPresets(userId);
  const { 
    presets: durationPresets, 
    loading: durationLoading, 
    createPreset: createDurationPreset, 
    deletePreset: deleteDurationPreset 
  } = useDurationPresets(userId);
  const { toast } = useToast();
  const [newType, setNewType] = useState('');
  const [newDuration, setNewDuration] = useState('');
  const [seededDefaults, setSeededDefaults] = useState(false);

  // Seed default presets on mount if none exist
  useEffect(() => {
    const seedDefaults = async () => {
      if (!loading && !durationLoading && !seededDefaults) {
        // Seed appointment types if none exist
        if (presets.length === 0) {
          for (const preset of DEFAULT_TYPE_PRESETS) {
            await createPreset(preset);
          }
        }
        
        // Seed durations if none exist
        if (durationPresets.length === 0) {
          for (const duration of DEFAULT_DURATION_PRESETS) {
            await createDurationPreset(duration.label, duration.minutes);
          }
        }
        
        setSeededDefaults(true);
      }
    };
    seedDefaults();
  }, [loading, durationLoading, presets.length, durationPresets.length, seededDefaults, createPreset, createDurationPreset]);

  const handleAddType = async () => {
    if (!newType.trim()) return;
    
    const result = await createPreset(newType.trim());
    if (result) {
      setNewType('');
      toast({
        title: 'Type added',
        description: `"${newType.trim()}" has been added.`,
      });
    }
  };

  const handleDeleteType = async (id: string, label: string) => {
    await deletePreset(id);
    toast({
      title: 'Type removed',
      description: `"${label}" has been removed.`,
    });
  };

  const parseDurationInput = (input: string): { label: string; minutes: number } | null => {
    const cleaned = input.toLowerCase().trim();
    
    // Pure number (assumed minutes)
    if (/^\d+$/.test(cleaned)) {
      const minutes = parseInt(cleaned);
      const label = minutes < 60 ? `${minutes}m` : minutes === 60 ? '1h' : `${(minutes / 60).toFixed(1)}h`;
      return { label, minutes };
    }
    
    // Handle formats like "1h", "1.5h", "90m"
    const hourMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*h/);
    if (hourMatch) {
      const hours = parseFloat(hourMatch[1]);
      return { label: `${hours}h`, minutes: Math.round(hours * 60) };
    }
    
    const minuteMatch = cleaned.match(/^(\d+)\s*m/);
    if (minuteMatch) {
      const minutes = parseInt(minuteMatch[1]);
      return { label: `${minutes}m`, minutes };
    }
    
    return null;
  };

  const handleAddDuration = async () => {
    if (!newDuration.trim()) return;
    
    const parsed = parseDurationInput(newDuration);
    if (parsed && parsed.minutes > 0 && parsed.minutes <= 480) {
      const result = await createDurationPreset(parsed.label, parsed.minutes);
      if (result) {
        setNewDuration('');
        toast({
          title: 'Duration added',
          description: `"${parsed.label}" has been added.`,
        });
      }
    } else {
      toast({
        title: 'Invalid duration',
        description: 'Enter 5 minutes to 8 hours (e.g., 30, 1h, 90m).',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteDuration = async (id: string, label: string) => {
    await deleteDurationPreset(id);
    toast({
      title: 'Duration removed',
      description: `"${label}" has been removed.`,
    });
  };

  const handleSkip = () => {
    onComplete();
  };

  const handleContinue = () => {
    if (presets.length === 0 || durationPresets.length === 0) {
      toast({
        title: 'Add presets',
        description: 'Please add at least one appointment type and one duration to continue.',
        variant: 'destructive',
      });
      return;
    }
    onComplete();
  };

  if (loading || durationLoading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Set Up Booking Presets</CardTitle>
        <CardDescription>
          Add appointment types and durations you frequently use. These will speed up creating openings.
          You can always modify these later in Settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        
        {/* Appointment Types Section */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-1">Appointment Types</h3>
            <p className="text-sm text-muted-foreground">
              Quick-select labels for your services
            </p>
          </div>
          
          {presets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
              No appointment types yet. Add some below.
            </p>
          ) : (
            <div className="space-y-2">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center gap-2 p-3 border rounded-lg bg-card hover:border-muted-foreground/50 transition-colors"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm flex-1">{preset.label}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteType(preset.id, preset.label)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              placeholder="e.g., Haircut, Consultation"
              maxLength={40}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddType();
                }
              }}
            />
            <Button
              type="button"
              onClick={handleAddType}
              disabled={!newType.trim() || presets.length >= 20}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {presets.length >= 20 && (
            <p className="text-xs text-muted-foreground">
              Maximum 20 types reached
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t" />

        {/* Duration Presets Section */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-1">Duration Presets</h3>
            <p className="text-sm text-muted-foreground">
              Quick-select time lengths for your services
            </p>
          </div>
          
          {durationPresets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
              No duration presets yet. Add some below.
            </p>
          ) : (
            <div className="space-y-2">
              {durationPresets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center gap-2 p-3 border rounded-lg bg-card hover:border-muted-foreground/50 transition-colors"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm flex-1">{preset.label}</span>
                  <span className="text-xs text-muted-foreground">({preset.duration_minutes} min)</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteDuration(preset.id, preset.label)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              placeholder="e.g., 30, 1h, 90m"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddDuration();
                }
              }}
            />
            <Button
              type="button"
              onClick={handleAddDuration}
              disabled={!newDuration.trim() || durationPresets.length >= 20}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {durationPresets.length >= 20 && (
            <p className="text-xs text-muted-foreground">
              Maximum 20 durations reached
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleSkip}
            className="flex-1"
          >
            Skip for now
          </Button>
          <Button
            type="button"
            onClick={handleContinue}
            className={cn(
              "flex-1",
              (presets.length > 0 && durationPresets.length > 0) && "bg-primary"
            )}
          >
            <Check className="h-4 w-4 mr-2" />
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
