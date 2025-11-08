import { EventProps } from 'react-big-calendar';

interface SlotEventResource {
  status: string;
  customer?: string;
  phone?: string;
  appointmentName?: string;
}

export const SlotEvent = ({ event }: EventProps) => {
  const { title, resource } = event as any;
  const { customer } = resource as SlotEventResource;
  
  return (
    <div className="text-xs p-1">
      <div className="font-medium truncate">{title}</div>
      {customer && (
        <div className="text-white/90 truncate">{customer}</div>
      )}
    </div>
  );
};
