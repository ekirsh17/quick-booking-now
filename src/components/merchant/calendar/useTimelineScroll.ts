import { useEffect, useRef } from 'react';
import { isToday } from 'date-fns';

interface UseTimelineScrollProps {
  date: Date;
  containerRef: React.RefObject<HTMLDivElement>;
  enabled?: boolean;
}

export const useTimelineScroll = ({ date, containerRef, enabled = true }: UseTimelineScrollProps) => {
  const hasScrolled = useRef(false);

  const scrollToTime = (hours: number, minutes: number = 0, behavior: ScrollBehavior = 'smooth') => {
    if (!containerRef.current) return;

    // Each hour is 60px tall, calculate position
    const hourHeight = 60;
    const scrollPosition = (hours * hourHeight) + ((minutes / 60) * hourHeight);
    
    // Offset to show time ~1/4 from top (subtract 25% of viewport height)
    const offset = containerRef.current.clientHeight * 0.25;
    const finalPosition = Math.max(0, scrollPosition - offset);

    containerRef.current.scrollTo({
      top: finalPosition,
      behavior,
    });
  };

  const scrollToNow = (behavior: ScrollBehavior = 'smooth') => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    scrollToTime(hours, minutes, behavior);
  };

  useEffect(() => {
    if (!enabled || !isToday(date) || hasScrolled.current || !containerRef.current) {
      return;
    }

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      scrollToNow(behavior);
      hasScrolled.current = true;
    }, 100);

    return () => clearTimeout(timer);
  }, [date, enabled]);

  // Reset scroll flag when date changes
  useEffect(() => {
    hasScrolled.current = false;
  }, [date]);

  return { scrollToTime, scrollToNow };
};
