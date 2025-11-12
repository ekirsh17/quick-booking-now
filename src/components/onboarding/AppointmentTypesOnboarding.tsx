import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppointmentPresets } from '@/hooks/useAppointmentPresets';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, GripVertical, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppointmentTypesOnboardingProps {
  userId: string;
  onComplete: () => void;
}

const DEFAULT_PRESETS = [
  'Consultation',
  'Follow-up',
  'New Client',
  'Existing Client',
];

export const AppointmentTypesOnboarding = ({
  userId,
  onComplete,
}: AppointmentTypesOnboardingProps) => {
  const { presets, loading, createPreset, deletePreset } = useAppointmentPresets(userId);
  const { toast } = useToast();
  const [newType, setNewType] = useState('');
  const [seededDefaults, setSeededDefaults] = useState(false);

  // Seed default presets on mount if none exist
  useEffect(() => {
    const seedDefaults = async () => {
      if (!loading && presets.length === 0 && !seededDefaults) {
        for (const preset of DEFAULT_PRESETS) {
          await createPreset(preset);
        }
        setSeededDefaults(true);
      }
    };
    seedDefaults();
  }, [loading, presets.length, seededDefaults, createPreset]);

  const handleAdd = async () => {
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

  const handleDelete = async (id: string, label: string) => {
    await deletePreset(id);
    toast({
      title: 'Type removed',
      description: `"${label}" has been removed.`,
    });
  };

  const handleSkip = () => {
    onComplete();
  };

  const handleContinue = () => {
    if (presets.length === 0) {
      toast({
        title: 'Add at least one type',
        description: 'Please add at least one appointment type to continue.',
        variant: 'destructive',
      });
      return;
    }
    onComplete();
  };

  if (loading) {
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
        <CardTitle>Set Up Appointment Types</CardTitle>
        <CardDescription>
          Add the types of appointments you offer. These will be available when creating openings.
          You can always modify these later in Settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current presets */}
        <div className="space-y-3">
          <Label>Your Appointment Types</Label>
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
                    onClick={() => handleDelete(preset.id, preset.label)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add new type */}
        <div className="space-y-2">
          <Label htmlFor="new-type">Add Appointment Type</Label>
          <div className="flex gap-2">
            <Input
              id="new-type"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              placeholder="e.g., Haircut, Consultation"
              maxLength={40}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAdd();
                }
              }}
            />
            <Button
              type="button"
              onClick={handleAdd}
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
              presets.length > 0 && "bg-primary"
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
