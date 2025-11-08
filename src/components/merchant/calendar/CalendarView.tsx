import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './calendar.css';
import { SlotEvent } from './SlotEvent';
import { AgendaEvent } from './AgendaEvent';
import { CalendarToolbar } from './CalendarToolbar';

const locales = { 'en-US': enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarSlot {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    status: string;
    customer?: string;
    phone?: string;
    appointmentName?: string;
  };
}

interface CalendarViewProps {
  slots: any[];
  onEventClick: (slot: any) => void;
  defaultView?: View;
}

export const CalendarView = ({ slots, onEventClick, defaultView = 'week' }: CalendarViewProps) => {
  const events: CalendarSlot[] = slots.map(slot => ({
    id: slot.id,
    title: slot.appointmentName || 'Available',
    start: new Date(slot.startTime),
    end: new Date(slot.endTime),
    resource: {
      status: slot.status,
      customer: slot.customer,
      phone: slot.consumerPhone,
      appointmentName: slot.appointmentName,
    },
  }));

  const eventStyleGetter = (event: CalendarSlot) => {
    const status = event.resource.status;
    
    const styles = {
      open: {
        backgroundColor: 'hsl(var(--chart-2))', // green
        color: 'white',
      },
      pending_confirmation: {
        backgroundColor: 'hsl(var(--chart-3))', // amber
        color: 'white',
      },
      booked: {
        backgroundColor: 'hsl(var(--chart-1))', // blue
        color: 'white',
      },
    };

    return {
      style: styles[status as keyof typeof styles] || styles.open,
    };
  };

  const handleSelectEvent = (event: CalendarSlot) => {
    const slot = slots.find(s => s.id === event.id);
    if (slot) {
      onEventClick(slot);
    }
  };

  return (
    <div className="calendar-container">
      <Calendar
        localizer={localizer}
        events={events}
        defaultView={defaultView}
        views={['week', 'agenda']}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 600 }}
        min={new Date(0, 0, 0, 8, 0, 0)}
        max={new Date(0, 0, 0, 20, 0, 0)}
        components={{
          event: SlotEvent,
          agenda: { event: AgendaEvent },
          toolbar: CalendarToolbar,
        }}
        eventPropGetter={eventStyleGetter}
        onSelectEvent={handleSelectEvent}
        defaultDate={new Date()}
      />
    </div>
  );
};
