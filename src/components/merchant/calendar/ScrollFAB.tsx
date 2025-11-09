import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { openingsTokens } from './openingsTokens';

interface ScrollFABProps {
  onClick: () => void;
  showOnViews?: ('day' | 'week' | 'month')[];
  currentView: 'day' | 'week' | 'month';
}

export const ScrollFAB = ({ onClick, showOnViews = ['day', 'week'], currentView }: ScrollFABProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show on specified views
    if (!showOnViews.includes(currentView)) {
      setIsVisible(false);
      return;
    }

    const handleScroll = () => {
      const scrolled = window.scrollY > 200;
      setIsVisible(scrolled);
    };

    // Add keyboard shortcut
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.key === 'a' || e.key === 'A') && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        // Only if not in input field
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          onClick();
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('keydown', handleKeyPress);
    
    // Check initial scroll position
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [onClick, showOnViews, currentView]);

  if (!showOnViews.includes(currentView)) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            openingsTokens.fab.wrapper,
            isVisible ? openingsTokens.fab.visible : openingsTokens.fab.hidden
          )}>
            <Button
              size="icon"
              onClick={onClick}
              className={openingsTokens.fab.button}
              aria-label="Add Opening (Press A)"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Add Opening (Press A)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
