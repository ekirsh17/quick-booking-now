import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ToolbarProps, View } from 'react-big-calendar';
import { format } from 'date-fns';

export const CalendarToolbar = (toolbar: ToolbarProps) => {
  const goToBack = () => {
    toolbar.onNavigate('PREV');
  };

  const goToNext = () => {
    toolbar.onNavigate('NEXT');
  };

  const goToToday = () => {
    toolbar.onNavigate('TODAY');
  };

  const label = () => {
    const date = toolbar.date;
    if (toolbar.view === 'week') {
      return format(date, 'MMMM yyyy');
    }
    return toolbar.label;
  };

  return (
    <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div className="flex items-center gap-2">
        <Button onClick={goToToday} variant="outline" size="sm">
          Today
        </Button>
        <div className="flex items-center">
          <Button onClick={goToBack} variant="ghost" size="icon">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button onClick={goToNext} variant="ghost" size="icon">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="text-lg font-semibold">
        {label()}
      </div>

      <div className="flex gap-2">
        {toolbar.views && (toolbar.views as View[]).map((view) => (
          <Button
            key={view}
            onClick={() => toolbar.onView(view)}
            variant={toolbar.view === view ? 'default' : 'outline'}
            size="sm"
            className="capitalize"
          >
            {view}
          </Button>
        ))}
      </div>
    </div>
  );
};
