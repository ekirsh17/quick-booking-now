import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { DayColumn } from './DayColumn';

interface TwoDayViewProps {
  slots: any[];
  onEventClick: (slot: any) => void;
}

export const TwoDayView = ({ slots, onEventClick }: TwoDayViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
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
        
        <div className="text-sm font-medium">
          {format(currentDate, 'MMM d')} - {format(nextDay, 'MMM d')}
        </div>
        
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
