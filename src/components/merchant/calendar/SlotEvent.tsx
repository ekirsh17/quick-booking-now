import { EventProps } from 'react-big-calendar';
import { cn } from "@/lib/utils";

interface SlotEventResource {
  status: string;
  customer?: string;
  phone?: string;
  appointmentName?: string;
}

export const SlotEvent = ({ event }: EventProps) => {
  const { title, resource } = event as any;
  const { customer, status } = resource as SlotEventResource;
  
  return (
    <div className="text-xs p-1">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span 
          className={cn(
            "w-1.5 h-1.5 rounded-full flex-shrink-0",
            status === 'pending_confirmation' && "animate-pulse bg-white",
            status === 'open' && "bg-white/80",
            status === 'booked' && "bg-white/80"
          )} 
        />
        <div className="font-semibold truncate">{title}</div>
      </div>
      {customer && (
        <div className="text-white/90 truncate pl-2.5">{customer}</div>
      )}
    </div>
  );
};
