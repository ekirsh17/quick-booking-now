import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { NavigateAction } from 'react-big-calendar';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface CalendarToolbarProps {
  date: Date;
  label: string;
  onNavigate: (action: NavigateAction, newDate?: Date) => void;
}

export const CalendarToolbar = (toolbar: CalendarToolbarProps) => {
  const currentDate = toolbar.date;

  const goToBack = () => {
    toolbar.onNavigate('PREV');
  };

  const goToNext = () => {
    toolbar.onNavigate('NEXT');
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      toolbar.onNavigate('DATE', date);
    }
  };

  return (
    <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <Button onClick={goToBack} variant="ghost" size="icon">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              className="text-lg font-semibold hover:bg-transparent hover:text-primary px-2"
            >
              {format(currentDate, 'MMMM yyyy')}
              <ChevronDown className="h-4 w-4 ml-1 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
            <CalendarComponent
              mode="single"
              selected={currentDate}
              onSelect={handleDateSelect}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        
        <Button onClick={goToNext} variant="ghost" size="icon">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
