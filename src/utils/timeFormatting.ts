import { format } from "date-fns";

/**
 * Time formatting utilities for consistent display across the app
 */

/**
 * Formats a time range from start and end timestamps
 * @param startTime - ISO string or Date for start time
 * @param endTime - ISO string or Date for end time
 * @returns Formatted time range string (e.g., "2:00 PM - 3:30 PM")
 */
export const formatTimeRange = (startTime: string | Date, endTime: string | Date): string => {
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const end = typeof endTime === 'string' ? new Date(endTime) : endTime;
  
  const startStr = start.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit' 
  });
  
  const endStr = end.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit' 
  });
  
  return `${startStr} - ${endStr}`;
};

/**
 * Formats a single time for display
 * @param time - ISO string or Date
 * @returns Formatted time string (e.g., "2:00 PM")
 */
export const formatTime = (time: string | Date): string => {
  const timeObj = typeof time === 'string' ? new Date(time) : time;
  return format(timeObj, "h:mm a");
};

/**
 * Formats a date and time range
 * @param startTime - ISO string or Date for start time
 * @param endTime - ISO string or Date for end time
 * @returns Formatted date and time range (e.g., "Jan 15, 2:00 PM - 3:30 PM")
 */
export const formatDateTimeRange = (startTime: string | Date, endTime: string | Date): string => {
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const dateStr = format(start, "MMM d");
  const timeRange = formatTimeRange(startTime, endTime);
  return `${dateStr}, ${timeRange}`;
};
