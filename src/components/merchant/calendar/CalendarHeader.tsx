import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';

type ViewType = 'day' | 'week' | 'month';

interface CalendarHeaderProps {
  currentDate: Date;
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onDateChange: (date: Date) => void;
  onNavigate: (direction: 'prev' | 'next' | 'today') => void;
  onAddClick?: () => void;
}

export const CalendarHeader = ({
  currentDate,
  currentView,
  onViewChange,
  onDateChange,
  onNavigate,
  onAddClick,
}: CalendarHeaderProps) => {
  const viewButtons: { value: ViewType; label: string }[] = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 bg-card p-4 rounded-lg border shadow-sm">
      {/* Navigation Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigate('prev')}
          className="h-9 w-9"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <Button
          variant="outline"
          onClick={() => onNavigate('today')}
          className="h-9 px-3 min-w-[80px]"
        >
          Today
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigate('next')}
          className="h-9 w-9"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Date Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-9 px-3 ml-2">
              <CalendarIcon className="mr-2 h-4 w-4" />
              <span className="font-semibold">
                {format(currentDate, 'MMM d, yyyy')}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={currentDate}
              onSelect={(date) => date && onDateChange(date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Add Opening Button - Desktop Only */}
      {onAddClick && (
        <Button 
          onClick={onAddClick}
          className="hidden md:flex gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Opening
        </Button>
      )}

      {/* View Selector */}
      <div className="flex gap-1 bg-muted p-1 rounded-md">
        {viewButtons.map((button) => (
          <Button
            key={button.value}
            variant={currentView === button.value ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange(button.value)}
            className="h-8 px-4"
          >
            {button.label}
          </Button>
        ))}
      </div>
    </div>
  );
};
