import { List, CalendarDays, CalendarRange } from "lucide-react";
import { useEffect } from "react";
import { motion } from "framer-motion";

interface ViewSwitcherProps {
  currentView: 'day' | 'week' | 'agenda';
  onViewChange: (view: 'day' | 'week' | 'agenda') => void;
}

const VIEW_STORAGE_KEY = 'notifyme.view';

const views = [
  { id: 'agenda', label: 'List', icon: List, shortcut: '1' },
  { id: 'day', label: 'Day', icon: CalendarDays, shortcut: '2' },
  { id: 'week', label: 'Week', icon: CalendarRange, shortcut: '3' },
] as const;

export const ViewSwitcher = ({
  currentView,
  onViewChange,
}: ViewSwitcherProps) => {
  
  // Load saved view preference on mount
  useEffect(() => {
    const savedView = localStorage.getItem(VIEW_STORAGE_KEY);
    if (savedView && (savedView === 'day' || savedView === 'week' || savedView === 'agenda')) {
      onViewChange(savedView);
    }
  }, [onViewChange]);

  // Save view preference when it changes
  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, currentView);
  }, [currentView]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Cmd/Ctrl + 1/2/3 for view switching
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            onViewChange('agenda');
            break;
          case '2':
            e.preventDefault();
            onViewChange('day');
            break;
          case '3':
            e.preventDefault();
            onViewChange('week');
            break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onViewChange]);

  const handleViewClick = (viewId: 'day' | 'week' | 'agenda') => {
    onViewChange(viewId);
  };

  return (
    <div 
      className="inline-flex gap-0.5 md:gap-1 bg-gray-50 p-0.5 rounded-lg border border-gray-200"
      role="tablist"
      aria-label="View switcher"
    >
      {views.map((view) => {
        const isSelected = currentView === view.id;
        const Icon = view.icon;
        
        return (
          <motion.button
            key={view.id}
            onClick={() => handleViewClick(view.id as 'day' | 'week' | 'agenda')}
            role="tab"
            aria-selected={isSelected}
            aria-label={`${view.label} view (Cmd+${view.shortcut})`}
            className={`
              relative flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 
              text-xs md:text-sm font-medium rounded-md
              transition-all duration-120
              focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1
              ${isSelected 
                ? 'bg-gray-900 text-white shadow-sm' 
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 hover:text-gray-900'
              }
            `}
            whileTap={{ scale: 0.97 }}
            initial={false}
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.5} />
            <span className="hidden sm:inline">{view.label}</span>
            
            {/* Selection indicator animation */}
            {isSelected && (
              <motion.div
                layoutId="activeView"
                className="absolute inset-0 bg-gray-900 rounded-md -z-10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
};
