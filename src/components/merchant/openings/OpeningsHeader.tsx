import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isToday, isTomorrow, isThisWeek } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useIsMobile } from "@/hooks/use-mobile";
import { AddOpeningCTA } from './AddOpeningCTA';
import { useEffect, useState } from 'react';

interface OpeningsHeaderProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onAddOpening: () => void;
  currentView: 'day' | 'week' | 'month' | 'agenda';
  onViewChange: (view: 'day' | 'week' | 'month' | 'agenda') => void;
}

// Helper to get title text based on view
const getViewTitle = (view: 'day' | 'week' | 'month' | 'agenda', date: Date): string => {
  switch (view) {
    case 'agenda':
      if (isToday(date)) return 'Openings • Today';
      if (isTomorrow(date)) return 'Openings • Tomorrow';
      if (isThisWeek(date)) return `Openings • This Week`;
      return `Openings • ${format(date, 'MMM d, yyyy')}`;
    
    case 'day':
      return format(date, 'EEEE, MMMM d, yyyy');
    
    case 'week': {
      const weekStart = startOfWeek(date, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(date, { weekStartsOn: 0 });
      const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
      
      if (sameMonth) {
        return `${format(weekStart, 'MMMM d')} – ${format(weekEnd, 'd, yyyy')}`;
      }
      return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;
    }
    
    case 'month':
      return format(startOfMonth(date), 'MMMM yyyy');
    
    default:
      return 'Openings';
  }
};

export const OpeningsHeader = ({
  currentDate,
  onDateChange,
  onPreviousDay,
  onNextDay,
  onToday,
  onAddOpening,
  currentView,
  onViewChange,
}: OpeningsHeaderProps) => {
  const isMobile = useIsMobile();
  const [isScrolled, setIsScrolled] = useState(false);
  
  // Track scroll for shadow effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // T key for Today
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        onToday();
      }
      
      // Left/Right arrows for navigation (only when not in agenda view)
      if (currentView !== 'agenda') {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onPreviousDay();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          onNextDay();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView, onToday, onPreviousDay, onNextDay]);
  
  const titleText = getViewTitle(currentView, currentDate);
  
  return (
    <div 
      className={`sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b transition-shadow ${
        isScrolled ? 'shadow-sm' : ''
      }`}
    >
      <div className="px-4 md:px-6 py-3 md:py-4">
        {/* Row 1: Date Controls (left) & View Switcher (right) */}
        <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3">
          {/* Date Controls Group */}
          <div 
            className="flex items-center gap-2 flex-shrink-0"
            role="group"
            aria-label="Date controls"
          >
            {currentView !== 'agenda' && (
              <Button
                variant="outline"
                size="icon"
                onClick={onPreviousDay}
                className="h-10 w-10"
                aria-label="Previous"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={onToday}
              className="h-10 px-3 md:px-4 text-sm font-medium"
            >
              Today
            </Button>

            {currentView !== 'agenda' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-10 px-3 text-sm font-medium hover:bg-accent"
                    aria-label="Select date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    <span className="hidden md:inline">{format(currentDate, 'MMM d')}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={currentDate}
                    onSelect={(date) => {
                      if (date) {
                        onDateChange(date);
                      }
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            )}

            {currentView !== 'agenda' && (
              <Button
                variant="outline"
                size="icon"
                onClick={onNextDay}
                className="h-10 w-10"
                aria-label="Next"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* View Switcher Group */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <div 
              className="inline-flex rounded-lg border border-border bg-muted p-1"
              role="group"
              aria-label="View switcher"
            >
              <button
                onClick={() => onViewChange('agenda')}
                aria-pressed={currentView === 'agenda'}
                className={`px-2 md:px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all ${
                  currentView === 'agenda'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                List
              </button>
              <button
                onClick={() => onViewChange('day')}
                aria-pressed={currentView === 'day'}
                className={`px-2 md:px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all ${
                  currentView === 'day'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Day
              </button>
              <button
                onClick={() => onViewChange('week')}
                aria-pressed={currentView === 'week'}
                className={`px-2 md:px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all ${
                  currentView === 'week'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Wk
              </button>
              <button
                onClick={() => onViewChange('month')}
                aria-pressed={currentView === 'month'}
                className={`px-2 md:px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all ${
                  currentView === 'month'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Mo
              </button>
            </div>

            {/* Add Opening button - hidden on mobile, shown on tablet+ */}
            <div className="hidden md:block">
              <AddOpeningCTA onClick={onAddOpening} variant="inline" />
            </div>
          </div>
        </div>

        {/* Row 2: Title */}
        <div className="mt-2 md:mt-3">
          <h2 
            className="text-lg md:text-xl font-semibold text-center md:text-left"
            role="heading"
            aria-level={2}
          >
            {titleText}
          </h2>
        </div>
      </div>
    </div>
  );
};
