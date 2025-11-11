import { AddOpeningCTA } from './AddOpeningCTA';
import { DateControls } from './DateControls';
import { ViewSwitcher } from './ViewSwitcher';
import { useEffect, useState } from 'react';

interface OpeningsHeaderProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onAddOpening: () => void;
  currentView: 'day' | 'week' | 'agenda';
  onViewChange: (view: 'day' | 'week' | 'agenda') => void;
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
  const [isScrolled, setIsScrolled] = useState(false);
  
  // Track scroll for shadow effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  return (
    <div 
      className={`sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b transition-shadow ${
        isScrolled ? 'shadow-sm' : ''
      }`}
    >
      <div className="px-4 md:px-6 py-3 md:py-4">
        {/* Main Header Layout: Date Controls (left) | View Switcher + Add Button (right) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          
          {/* Left: Date Controls */}
          <DateControls
            currentDate={currentDate}
            currentView={currentView}
            onPrevious={onPreviousDay}
            onNext={onNextDay}
            onToday={onToday}
          />

          {/* Right: View Switcher + Add Opening Button */}
          <div className="flex items-center gap-2 md:gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <ViewSwitcher
              currentView={currentView}
              onViewChange={onViewChange}
            />

            {/* Add Opening button - hidden on mobile, shown on tablet+ */}
            <div className="hidden md:block">
              <AddOpeningCTA onClick={onAddOpening} variant="inline" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
