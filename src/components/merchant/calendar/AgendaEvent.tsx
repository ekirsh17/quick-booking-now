import { Badge } from "@/components/ui/badge";
import { User, Phone } from "lucide-react";

export const AgendaEvent = ({ event }: { event: any }) => {
  const { resource } = event;
  const { status, customer, phone, appointmentName } = resource;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {appointmentName && (
          <Badge variant="secondary" className="text-xs">
            {appointmentName}
          </Badge>
        )}
        <Badge 
          variant={
            status === 'booked' ? 'default' : 
            status === 'pending_confirmation' ? 'secondary' : 
            'outline'
          }
          className={
            status === 'pending_confirmation' 
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-100' 
              : ''
          }
        >
          {status === 'booked' ? 'Booked' : 
           status === 'pending_confirmation' ? 'Pending' :
           'Open'}
        </Badge>
      </div>
      {customer && (
        <div className="text-sm space-y-1">
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5" />
            <span>{customer}</span>
          </div>
          {phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5" />
              <a 
                href={`tel:${phone}`}
                className="hover:underline"
              >
                {phone}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
