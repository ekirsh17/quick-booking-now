interface OpeningsCalendarProps {
  currentDate: Date;
  currentView: 'day' | 'week' | 'month';
}

export const OpeningsCalendar = ({ currentDate, currentView }: OpeningsCalendarProps) => {
  return (
    <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="text-center space-y-2">
        <p className="text-lg font-medium text-muted-foreground">
          Calendar views coming in Phase 2
        </p>
        <p className="text-sm text-muted-foreground">
          Currently viewing: <span className="font-semibold capitalize">{currentView}</span> view
        </p>
        <p className="text-xs text-muted-foreground">
          Selected date: {currentDate.toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};
