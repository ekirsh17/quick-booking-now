import { Card } from "@/components/ui/card";

export const CalendarLegend = () => {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap gap-4 items-center">
        <span className="text-sm font-medium">Legend:</span>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(var(--chart-2))' }}></div>
          <span className="text-sm">Open</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(var(--chart-3))' }}></div>
          <span className="text-sm">Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(var(--chart-1))' }}></div>
          <span className="text-sm">Booked</span>
        </div>
      </div>
    </Card>
  );
};
