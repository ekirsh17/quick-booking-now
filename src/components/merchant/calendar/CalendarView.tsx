import { useState, useEffect } from 'react';
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
  onSelectSlot?: (slotInfo: { start: Date; end: Date }) => void;
  defaultView?: View;
}

export const CalendarView = ({ slots, onEventClick, onSelectSlot, defaultView = 'week' }: CalendarViewProps) => {
  const [currentView, setCurrentView] = useState<View>(() => {
    const saved = localStorage.getItem('calendarView');
    return (saved as View) || defaultView;
  });

  useEffect(() => {
    localStorage.setItem('calendarView', currentView);
  }, [currentView]);

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
        backgroundColor: '#10b981', // Emerald 500
        borderColor: '#059669', // Emerald 600
        color: 'white',
      },
      pending_confirmation: {
        backgroundColor: '#f59e0b', // Amber 500
        borderColor: '#d97706', // Amber 600
        color: 'white',
      },
      booked: {
        backgroundColor: '#3b82f6', // Blue 500
        borderColor: '#2563eb', // Blue 600
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

  const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
    if (onSelectSlot) {
      onSelectSlot(slotInfo);
    }
  };

  const handleViewChange = (view: View) => {
    setCurrentView(view);
  };

  return (
    <div className="calendar-container">
      <Calendar
        localizer={localizer}
        events={events}
        view={currentView}
        onView={setCurrentView}
        views={['week', 'agenda']}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}
        min={new Date(0, 0, 0, 7, 0, 0)}
        max={new Date(0, 0, 0, 19, 0, 0)}
        step={15}
        timeslots={4}
        selectable={true}
        components={{
          event: SlotEvent,
          agenda: {
            event: AgendaEvent,
          },
          toolbar: (toolbarProps) => (
            <CalendarToolbar 
              {...toolbarProps} 
              currentView={currentView}
              onViewChange={handleViewChange}
            />
          ),
        }}
        eventPropGetter={eventStyleGetter}
        onSelectEvent={handleSelectEvent}
        onSelectSlot={handleSelectSlot}
        defaultDate={new Date()}
      />
    </div>
  );
};
