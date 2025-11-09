import { useState, useCallback, useRef } from 'react';

export interface TimeSelection {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

interface Position {
  x: number;
  y: number;
}

export const useTimelineGestures = (snapMinutes: number = 5) => {
  const [selection, setSelection] = useState<TimeSelection | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'move' | 'resize-top' | 'resize-bottom' | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout>();
  const touchStartPos = useRef<Position>({ x: 0, y: 0 });
  const lastTapTime = useRef<number>(0);

  const snapToGrid = useCallback((minutes: number): number => {
    return Math.round(minutes / snapMinutes) * snapMinutes;
  }, [snapMinutes]);

  const getTimeFromY = useCallback((y: number, containerTop: number): { hour: number; minute: number } => {
    const hourHeight = 60; // px per hour
    const relativeY = Math.max(0, y - containerTop);
    const totalMinutes = (relativeY / hourHeight) * 60;
    const snappedMinutes = snapToGrid(totalMinutes);
    
    const hour = Math.floor(snappedMinutes / 60);
    const minute = snappedMinutes % 60;
    
    return {
      hour: Math.max(0, Math.min(23, hour)),
      minute: Math.max(0, Math.min(59, minute)),
    };
  }, [snapToGrid]);

  const handleTouchStart = useCallback((e: React.TouchEvent, containerRef: React.RefObject<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    
    // Check for double tap
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTime.current;
    lastTapTime.current = now;

    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      // Double tap detected
      handleDoubleTap(touch.clientY, containerRef);
      return;
    }

    // Start long press timer
    longPressTimer.current = setTimeout(() => {
      handleLongPress(touch.clientY, containerRef);
    }, 500);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (longPressTimer.current) {
      const touch = e.touches[0];
      const moveDistance = Math.sqrt(
        Math.pow(touch.clientX - touchStartPos.current.x, 2) +
        Math.pow(touch.clientY - touchStartPos.current.y, 2)
      );

      // Cancel long press if moved more than 10px
      if (moveDistance > 10) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = undefined;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = undefined;
    }
  }, []);

  const handleDoubleTap = useCallback((y: number, containerRef: React.RefObject<HTMLDivElement>) => {
    if (!containerRef.current) return;
    
    const containerTop = containerRef.current.getBoundingClientRect().top;
    const { hour, minute } = getTimeFromY(y, containerTop);
    
    // Create 30-minute selection
    const startMinutes = hour * 60 + minute;
    const endMinutes = Math.min(startMinutes + 30, 24 * 60 - 1);
    
    setSelection({
      startHour: Math.floor(startMinutes / 60),
      startMinute: startMinutes % 60,
      endHour: Math.floor(endMinutes / 60),
      endMinute: endMinutes % 60,
    });
  }, [getTimeFromY]);

  const handleLongPress = useCallback((y: number, containerRef: React.RefObject<HTMLDivElement>) => {
    if (!containerRef.current) return;
    
    const containerTop = containerRef.current.getBoundingClientRect().top;
    const { hour, minute } = getTimeFromY(y, containerTop);
    
    // Create 30-minute selection
    const startMinutes = hour * 60 + minute;
    const endMinutes = Math.min(startMinutes + 30, 24 * 60 - 1);
    
    setSelection({
      startHour: Math.floor(startMinutes / 60),
      startMinute: startMinutes % 60,
      endHour: Math.floor(endMinutes / 60),
      endMinute: endMinutes % 60,
    });

    // Trigger haptic feedback if available
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  }, [getTimeFromY]);

  const updateSelection = useCallback((newSelection: Partial<TimeSelection>) => {
    setSelection(prev => prev ? { ...prev, ...newSelection } : null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setIsDragging(false);
    setDragMode(null);
  }, []);

  return {
    selection,
    setSelection,
    isDragging,
    setIsDragging,
    dragMode,
    setDragMode,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    updateSelection,
    clearSelection,
    getTimeFromY,
  };
};
