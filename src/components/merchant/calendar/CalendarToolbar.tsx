import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, List } from "lucide-react";
import { View, NavigateAction } from 'react-big-calendar';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CalendarToolbarProps {
  date: Date;
  view: View;
  views: View[];
  label: string;
  localizer: any;
  onNavigate: (action: NavigateAction, newDate?: Date) => void;
  onView: (view: View) => void;
  currentView: View;
  onViewChange: (view: View) => void;
}

export const CalendarToolbar = (toolbar: CalendarToolbarProps) => {
  const { currentView, onViewChange } = toolbar;
  const currentDate = toolbar.date;
  const currentMonth = format(currentDate, 'M');
  const currentYear = format(currentDate, 'yyyy');

  const goToBack = () => {
    toolbar.onNavigate('PREV');
  };

  const goToNext = () => {
    toolbar.onNavigate('NEXT');
  };

  const handleMonthChange = (month: string) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(parseInt(month) - 1);
    toolbar.onNavigate('DATE', newDate);
  };

  const handleYearChange = (year: string) => {
    const newDate = new Date(currentDate);
    newDate.setFullYear(parseInt(year));
    toolbar.onNavigate('DATE', newDate);
  };

  const currentYearNum = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYearNum - 5 + i);

  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  return (
    <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div className="flex items-center gap-2">
        <Button onClick={goToBack} variant="ghost" size="icon">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button onClick={goToNext} variant="ghost" size="icon">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex items-center gap-2">
        <Select value={currentMonth} onValueChange={handleMonthChange}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((month) => (
              <SelectItem key={month.value} value={month.value}>
                {month.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={currentYear} onValueChange={handleYearChange}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1 border rounded-md">
        <Button
          variant={currentView === 'week' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onViewChange('week')}
          className="rounded-r-none"
        >
          <Calendar className="h-4 w-4" />
        </Button>
        <Button
          variant={currentView === 'agenda' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onViewChange('agenda')}
          className="rounded-l-none"
        >
          <List className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
