import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { format, isSameDay, startOfToday, addDays } from 'date-fns';
import { DayColumn } from './DayColumn';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface TwoDayViewProps {
  slots: any[];
  onEventClick: (slot: any) => void;
}

export const TwoDayView = ({ slots, onEventClick }: TwoDayViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  
  const nextDay = new Date(currentDate);
  nextDay.setDate(currentDate.getDate() + 1);

  const handlePrevDays = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() - 2);
      return newDate;
    });
  };

  const handleNextDays = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + 2);
      return newDate;
    });
  };

  const filterSlotsByDate = (date: Date) => {
    return slots.filter(slot => 
      isSameDay(new Date(slot.startTime), date)
    );
  };

  const handleQuickJump = (action: 'today' | 'tomorrow') => {
    const today = startOfToday();
    if (action === 'today') {
      setCurrentDate(today);
    } else if (action === 'tomorrow') {
      setCurrentDate(addDays(today, 1));
    }
    setDatePickerOpen(false);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setCurrentDate(date);
      setDatePickerOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Navigation Header */}
      <div className="flex items-center justify-between bg-card rounded-lg p-3 border">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handlePrevDays}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden xs:inline">Prev</span>
        </Button>
        
        <Sheet open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-sm font-medium hover:bg-transparent hover:text-primary gap-1"
            >
              {format(currentDate, 'MMM d')} - {format(nextDay, 'MMM d')}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto">
            <SheetHeader>
              <SheetTitle>Jump to Date</SheetTitle>
              <SheetDescription>
                Select a date to view openings
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 mt-6">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleQuickJump('today')}
                  className="w-full"
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleQuickJump('tomorrow')}
                  className="w-full"
                >
                  Tomorrow
                </Button>
              </div>
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={currentDate}
                  onSelect={handleDateSelect}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </div>
            </div>
          </SheetContent>
        </Sheet>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleNextDays}
          className="gap-1"
        >
          <span className="hidden xs:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Two Day Grid */}
      <div className="grid grid-cols-2 gap-3">
        <DayColumn 
          date={currentDate} 
          slots={filterSlotsByDate(currentDate)} 
          onEventClick={onEventClick}
        />
        <DayColumn 
          date={nextDay} 
          slots={filterSlotsByDate(nextDay)} 
          onEventClick={onEventClick}
        />
      </div>
    </div>
  );
};
