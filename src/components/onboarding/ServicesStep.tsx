import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppointmentPresets } from '@/hooks/useAppointmentPresets';
import { useDurationPresets } from '@/hooks/useDurationPresets';
import { useAuth } from '@/hooks/useAuth';
import { DEFAULT_APPOINTMENT_TYPES, DEFAULT_DURATIONS } from '@/types/onboarding';
import { ChevronLeft, ChevronRight, Plus, X, Clock, Tag, AlertCircle } from 'lucide-react';

interface ServicesStepProps {
  onContinue: () => void;
  onBack: () => void;
}

export function ServicesStep({ onContinue, onBack }: ServicesStepProps) {
  const { user } = useAuth();
  const { 
    presets: appointmentTypes, 
    loading: typesLoading, 
    createPreset: createType, 
    deletePreset: deleteType,
    refetch: refetchTypes
  } = useAppointmentPresets(user?.id);
  
  const { 
    presets: durations, 
    loading: durationsLoading, 
    createPreset: createDuration, 
    deletePreset: deleteDuration,
    refetch: refetchDurations
  } = useDurationPresets(user?.id);
  
  const [newType, setNewType] = useState('');
  const [newDuration, setNewDuration] = useState('');
  const [seededDefaults, setSeededDefaults] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // Seed defaults on mount if none exist
  // Profile should already exist from login/onboarding step 2
  useEffect(() => {
    const seedDefaults = async () => {
      if (!typesLoading && !durationsLoading && !seededDefaults && !isSeeding && user) {
        setIsSeeding(true);
        setSeedError(null);

        try {
          // Seed appointment types if none exist
          if (appointmentTypes.length === 0) {
            for (const type of DEFAULT_APPOINTMENT_TYPES) {
              await createType(type);
            }
          }

          // Seed durations if none exist
          if (durations.length === 0) {
            for (const duration of DEFAULT_DURATIONS) {
              await createDuration(duration.label, duration.minutes);
            }
          }

          // Refetch to ensure we have latest data
          await refetchTypes();
          await refetchDurations();

          setSeededDefaults(true);
        } catch (error) {
          console.error('Error seeding defaults:', error);
          setSeedError('Failed to set up defaults. You can add them manually below.');
        } finally {
          setIsSeeding(false);
        }
      }
    };
    seedDefaults();
  }, [typesLoading, durationsLoading, seededDefaults, isSeeding, user, appointmentTypes.length, durations.length, createType, createDuration, refetchTypes, refetchDurations]);
  
  const handleAddType = async () => {
    if (!newType.trim()) return;
    await createType(newType.trim());
    setNewType('');
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
      await createDuration(parsed.label, parsed.minutes);
      setNewDuration('');
    }
  };
  
  const isLoading = typesLoading || durationsLoading || isSeeding;
  
  return (
    <div className="flex flex-col px-2">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-1">Set up your services</h2>
        <p className="text-sm text-muted-foreground">
          These will speed up creating openings. You can customize later.
        </p>
      </div>

      {/* Error message if seeding failed */}
      {seedError && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-destructive/10 text-destructive text-sm animate-in fade-in-0 duration-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{seedError}</span>
        </div>
      )}
      
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in-0 duration-300">
          {/* Appointment Types */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">Appointment Types</span>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-3 min-h-[40px]">
              {appointmentTypes.map((type) => (
                <div
                  key={type.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary rounded-full text-sm animate-in fade-in-0 zoom-in-95 duration-200"
                >
                  <span>{type.label}</span>
                  <button
                    onClick={() => deleteType(type.id)}
                    className="text-foreground/70"
                    aria-label={`Remove ${type.label}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Input
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                placeholder="Add custom type..."
                maxLength={40}
                onKeyDown={(e) => e.key === 'Enter' && handleAddType()}
                className="flex-1"
              />
              <Button
                onClick={handleAddType}
                size="icon"
                variant="outline"
                disabled={!newType.trim() || appointmentTypes.length >= 20}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Durations */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">Duration Presets</span>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-3 min-h-[40px]">
              {durations.map((duration) => (
                <div
                  key={duration.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary rounded-full text-sm animate-in fade-in-0 zoom-in-95 duration-200"
                >
                  <span>{duration.label}</span>
                  <button
                    onClick={() => deleteDuration(duration.id)}
                    className="text-foreground/70"
                    aria-label={`Remove ${duration.label}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Input
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                placeholder="e.g., 30, 1h, 90m..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddDuration()}
                className="flex-1"
              />
              <Button
                onClick={handleAddDuration}
                size="icon"
                variant="outline"
                disabled={!newDuration.trim() || durations.length >= 20}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Tip */}
      <div className="bg-muted/50 rounded-lg p-3 mt-6 mb-6">
        <p className="text-xs text-muted-foreground">
          💡 <strong>Tip:</strong> These are just defaults. You can add custom values when creating openings.
        </p>
      </div>
      
      {/* Actions */}
      <div className="flex gap-3 mt-auto animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
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
          disabled={isLoading}
        >
          Continue
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
