import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useIsMobile } from "@/hooks/use-mobile";

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
  
  return (
    <div className="space-y-4 mb-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Openings</h1>
      </div>

      {/* Date Navigation & View Switcher */}
      <div className="flex items-center justify-between gap-2">
        {/* Date Navigation */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {currentView !== 'agenda' && (
            <Button
              variant="outline"
              size="icon"
              onClick={onPreviousDay}
              className="h-9 w-9 flex-shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          
          <Button
            variant="outline"
            onClick={onToday}
            className="h-9 px-3 md:px-4 text-sm font-medium flex-shrink-0"
          >
            Today
          </Button>

          {currentView !== 'agenda' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 px-2 md:px-3 text-sm font-medium hover:bg-accent flex-1 lg:flex-none min-w-0 justify-start"
                >
                  <CalendarIcon className="mr-1 md:mr-2 h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{format(currentDate, isMobile ? 'MMM d, yyyy' : 'MMM d, yyyy')}</span>
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
              className="h-9 w-9 flex-shrink-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* View Switcher - Segmented Control */}
        <div className="inline-flex rounded-lg border border-border bg-muted p-1 flex-shrink-0">
          <button
            onClick={() => onViewChange('agenda')}
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
            className={`px-2 md:px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all ${
              currentView === 'week'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {isMobile ? 'Wk' : 'Week'}
          </button>
          <button
            onClick={() => onViewChange('month')}
            className={`px-2 md:px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all ${
              currentView === 'month'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {isMobile ? 'Mo' : 'Month'}
          </button>
        </div>
      </div>
    </div>
  );
};
