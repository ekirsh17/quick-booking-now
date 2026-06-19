import { useState } from 'react';
import { CircleHelp, ClipboardList, Compass, Loader2, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useActivationContext } from '@/contexts/ActivationContext';
import { useTourContext } from '@/contexts/TourContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { subtleAccentSurfaceOpen } from '@/lib/interactiveHover';
import { buildEmailSyncGuideSettingsPath } from '@/lib/emailSyncSetupGuideState';
import { HELP_GUIDES_AUTO_OPENINGS_LABEL } from '@/lib/emailSyncSetupGuides';
import { cn } from '@/lib/utils';

export function SettingsGuidesSection() {
  const navigate = useNavigate();
  const { openSetupChecklist, loading, showSetupChecklist } = useActivationContext();
  const { restartQuickTour, isTourActive, stopQuickTour } = useTourContext();
  const isMobile = useIsMobile();
  const [checklistBusy, setChecklistBusy] = useState(false);
  const [tourBusy, setTourBusy] = useState(false);

  const isChecklistPanelOpen = showSetupChecklist && !isTourActive;
  const isProductTourOpen = isTourActive;

  const handleOpenChecklist = async () => {
    setChecklistBusy(true);
    try {
      if (isTourActive) {
        stopQuickTour();
      }
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
            className={cn(
              'h-8 gap-1.5 px-2 text-xs text-muted-foreground',
              subtleAccentSurfaceOpen
            )}
          >
            <CircleHelp className="h-3.5 w-3.5" aria-hidden />
            Help &amp; Guides
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          side={isMobile ? 'top' : 'bottom'}
          sideOffset={8}
          avoidCollisions={!isMobile}
          collisionPadding={isMobile ? { top: 8, right: 8, bottom: 88, left: 8 } : 8}
          className="z-[70] w-48 max-h-[min(14rem,calc(100dvh-10rem))] overflow-y-auto md:max-h-[var(--radix-dropdown-menu-content-available-height)]"
        >
          <DropdownMenuItem
            disabled={isProductTourOpen || tourBusy}
            className="data-[highlighted]:bg-warning data-[highlighted]:text-warning-foreground focus:bg-warning focus:text-warning-foreground"
            onClick={() => void handleRestartTour()}
          >
            {tourBusy ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Compass className="mr-2 h-3.5 w-3.5" aria-hidden />
            )}
            Product tour
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={loading || checklistBusy || isChecklistPanelOpen}
            className="data-[highlighted]:bg-warning data-[highlighted]:text-warning-foreground focus:bg-warning focus:text-warning-foreground"
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
            className="data-[highlighted]:bg-warning data-[highlighted]:text-warning-foreground focus:bg-warning focus:text-warning-foreground"
            onClick={() => navigate(buildEmailSyncGuideSettingsPath())}
          >
            <Mail className="mr-2 h-3.5 w-3.5" aria-hidden />
            {HELP_GUIDES_AUTO_OPENINGS_LABEL}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
