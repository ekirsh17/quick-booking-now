import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, endOfWeek, isToday } from "date-fns";
import { useEffect } from "react";

interface DateControlsProps {
  currentDate: Date;
  currentView: 'day' | 'week' | 'agenda';
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}

export const DateControls = ({
  currentDate,
  currentView,
  onPrevious,
  onNext,
  onToday,
}: DateControlsProps) => {
  
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
      
      // Left/Right arrows for navigation
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNext();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPrevious, onNext, onToday]);

  // Get label text based on view
  const getDateLabel = (): string => {
    switch (currentView) {
      case 'agenda':
        return format(currentDate, 'MMM d, yyyy');
      case 'day':
        return format(currentDate, 'EEE, MMM d');
      case 'week': {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
        const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
        
        if (sameMonth) {
          return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'd')}`;
        }
        return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')}`;
      }
      default:
        return format(currentDate, 'MMM d, yyyy');
    }
  };

  // Get unit name for aria-label
  const getUnitName = (): string => {
    switch (currentView) {
      case 'day':
      case 'agenda':
        return 'day';
      case 'week':
        return 'week';
      default:
        return 'period';
    }
  };

  const unitName = getUnitName();
  const dateLabel = getDateLabel();
  const showTodayHighlight = isToday(currentDate);

  return (
    <div 
      className="flex items-center gap-1 md:gap-2"
      role="group"
      aria-label="Date navigation"
    >
      {/* Previous Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={onPrevious}
        className="h-9 w-9 border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        aria-label={`Previous ${unitName}`}
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
      </Button>

      {/* Today Button */}
      <Button
        variant={showTodayHighlight ? "default" : "outline"}
        onClick={onToday}
        className={`h-9 px-3 md:px-4 text-sm font-medium transition-all ${
          showTodayHighlight 
            ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800' 
            : 'border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`}
        aria-label="Go to today"
      >
        Today
      </Button>

      {/* Date Label */}
      <div 
        className="hidden sm:flex items-center px-3 h-9 text-sm font-medium text-gray-900"
        aria-live="polite"
        aria-atomic="true"
      >
        {dateLabel}
      </div>

      {/* Next Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={onNext}
        className="h-9 w-9 border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        aria-label={`Next ${unitName}`}
      >
        <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
      </Button>
    </div>
  );
};
