import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CalendarDays, CalendarRange } from "lucide-react";
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
  currentView: 'day' | 'week' | 'month';
  onViewChange: (view: 'day' | 'week' | 'month') => void;
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
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
        {/* Date Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onPreviousDay}
            className="h-9 w-9"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            onClick={onToday}
            className="h-9 px-4 text-sm font-medium"
          >
            Today
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-9 px-3 text-sm font-medium hover:bg-accent"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(currentDate, isMobile ? 'MMM d, yyyy' : 'EEEE, MMMM d, yyyy')}
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

          <Button
            variant="outline"
            size="icon"
            onClick={onNextDay}
            className="h-9 w-9"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* View Switcher - Segmented Control */}
        <div className="inline-flex rounded-lg border border-border bg-muted p-1">
          <button
            onClick={() => onViewChange('day')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
              currentView === 'day'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {isMobile ? <CalendarIcon className="h-4 w-4" /> : 'Day'}
          </button>
          <button
            onClick={() => onViewChange('week')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
              currentView === 'week'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {isMobile ? <CalendarDays className="h-4 w-4" /> : 'Week'}
          </button>
          <button
            onClick={() => onViewChange('month')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
              currentView === 'month'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {isMobile ? <CalendarRange className="h-4 w-4" /> : 'Month'}
          </button>
        </div>
      </div>
    </div>
  );
};
