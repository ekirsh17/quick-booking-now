import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { openingsTokens } from './openingsTokens';

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
    <div className={openingsTokens.controls.wrapper}>
      {/* Navigation Controls */}
      <div className={openingsTokens.controls.navGroup}>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigate('prev')}
          className={openingsTokens.controls.navButton}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <Button
          variant="outline"
          onClick={() => onNavigate('today')}
          className={openingsTokens.controls.todayButton}
        >
          Today
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigate('next')}
          className={openingsTokens.controls.navButton}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Date Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={openingsTokens.controls.datePickerButton}>
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
          className={openingsTokens.controls.addButton}
        >
          <Plus className="h-4 w-4" />
          Add Opening
        </Button>
      )}

      {/* View Selector */}
      <div className={openingsTokens.controls.viewSelector.wrapper}>
        {viewButtons.map((button) => (
          <Button
            key={button.value}
            variant={currentView === button.value ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange(button.value)}
            className={openingsTokens.controls.viewSelector.button}
          >
            {button.label}
          </Button>
        ))}
      </div>
    </div>
  );
};
