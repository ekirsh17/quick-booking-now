import { useState } from 'react';
import { CircleHelp, ClipboardList, Compass, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useActivationContext } from '@/contexts/ActivationContext';
import { useTourContext } from '@/contexts/TourContext';

export function SettingsGuidesSection() {
  const { openSetupChecklist, loading } = useActivationContext();
  const { restartQuickTour, isTourActive, isTourBlocked } = useTourContext();
  const [checklistBusy, setChecklistBusy] = useState(false);
  const [tourBusy, setTourBusy] = useState(false);

  const tourDisabled = isTourActive || isTourBlocked;

  const handleOpenChecklist = async () => {
    setChecklistBusy(true);
    try {
      await openSetupChecklist();
    } finally {
      setChecklistBusy(false);
    }
  };

  const handleRestartTour = async () => {
    setTourBusy(true);
    try {
      await restartQuickTour();
    } finally {
      setTourBusy(false);
    }
  };

  return (
    <div className="flex justify-center pt-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
          >
            <CircleHelp className="h-3.5 w-3.5" aria-hidden />
            Help &amp; guides
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-48">
          <DropdownMenuItem
            disabled={loading || checklistBusy}
            onClick={() => void handleOpenChecklist()}
          >
            {checklistBusy ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <ClipboardList className="mr-2 h-3.5 w-3.5" aria-hidden />
            )}
            Setup checklist
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={tourDisabled || tourBusy}
            onClick={() => void handleRestartTour()}
          >
            {tourBusy ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Compass className="mr-2 h-3.5 w-3.5" aria-hidden />
            )}
            Product tour
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
