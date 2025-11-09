import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

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
  return (
    <div className="space-y-4 mb-6">
      {/* Page Title & Primary CTA */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Openings</h1>
        <Button onClick={onAddOpening} className="hidden md:flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Opening
        </Button>
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
                {format(currentDate, 'EEEE, MMMM d, yyyy')}
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
          {(['day', 'week', 'month'] as const).map((view) => (
            <button
              key={view}
              onClick={() => onViewChange(view)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all capitalize ${
                currentView === view
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {view}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile FAB - Floating Action Button */}
      <Button
        onClick={onAddOpening}
        size="lg"
        className="md:hidden fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg z-50"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
};
