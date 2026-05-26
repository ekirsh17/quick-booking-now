import { useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

interface AddOpeningCTAProps {
  onClick: () => void;
  variant?: 'auto' | 'fab' | 'inline';
  className?: string;
  disabled?: boolean;
  onFloatingClearanceChange?: (clearancePx: number | null) => void;
  /** When set, enables setup checklist scroll/highlight on this CTA. */
  setupSectionId?: string;
}

export const AddOpeningCTA = ({ 
  onClick, 
  variant = 'auto',
  className = '',
  disabled = false,
  onFloatingClearanceChange,
  setupSectionId,
}: AddOpeningCTAProps) => {
  const isMobile = useIsMobile();
  const fabButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastScrollYRef = useRef(0);
  const isCollapsedRef = useRef(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const FAB_COLLAPSED_WIDTH = 48;
  const FAB_EXPANDED_WIDTH = 150;
  const FAB_TOP_EXPAND_THRESHOLD = 40;
  const FAB_COLLAPSE_SCROLL_THRESHOLD = 88;
  const FAB_SCROLL_DELTA_THRESHOLD = 8;

  // Auto variant: choose based on screen size
  const effectiveVariant = variant === 'auto' 
    ? (isMobile ? 'fab' : 'inline')
    : variant;

  useEffect(() => {
    if (effectiveVariant !== 'fab' || !isMobile) {
      isCollapsedRef.current = false;
      setIsCollapsed(false);
      return;
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const deltaY = currentScrollY - lastScrollYRef.current;
      let nextCollapsed = isCollapsedRef.current;

      if (currentScrollY <= FAB_TOP_EXPAND_THRESHOLD) {
        nextCollapsed = false;
      } else if (
        deltaY >= FAB_SCROLL_DELTA_THRESHOLD &&
        currentScrollY >= FAB_COLLAPSE_SCROLL_THRESHOLD
      ) {
        nextCollapsed = true;
      } else if (deltaY <= -FAB_SCROLL_DELTA_THRESHOLD) {
        nextCollapsed = false;
      }

      if (nextCollapsed !== isCollapsedRef.current) {
        isCollapsedRef.current = nextCollapsed;
        setIsCollapsed(nextCollapsed);
      }

      lastScrollYRef.current = currentScrollY;
    };

    lastScrollYRef.current = window.scrollY;
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => window.removeEventListener('scroll', handleScroll);
  }, [effectiveVariant, isMobile]);

  useEffect(() => {
    if (!onFloatingClearanceChange) return;

    if (effectiveVariant !== 'fab' || !isMobile) {
      onFloatingClearanceChange(null);
      return;
    }

    const updateClearance = () => {
      const fabButton = fabButtonRef.current;
      if (!fabButton) return;
      const rect = fabButton.getBoundingClientRect();
      const rightClearance = Math.max(0, window.innerWidth - rect.left + 12);
      onFloatingClearanceChange(Math.ceil(rightClearance));
    };

    updateClearance();
    window.addEventListener('resize', updateClearance);

    const observer = new ResizeObserver(updateClearance);
    if (fabButtonRef.current) {
      observer.observe(fabButtonRef.current);
    }

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateClearance);
      onFloatingClearanceChange(null);
    };
  }, [effectiveVariant, isMobile, onFloatingClearanceChange]);

  // Desktop/Tablet inline button (rendered in header)
  if (effectiveVariant === 'inline') {
    return (
      <Button
        onClick={disabled ? undefined : onClick}
        size="default"
        className={`h-9 shadow-sm hover:shadow-md transition-shadow ${className}`}
        aria-label="Add Opening"
        disabled={disabled}
        data-tour-target="new-opening-btn"
        {...(setupSectionId ? { 'data-setup-section': setupSectionId } : {})}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Opening
      </Button>
    );
  }

  const spring = {
    type: "spring" as const,
    stiffness: 400,
    damping: 28
  };

  return (
    <motion.div
      className="fixed right-4 z-40"
      {...(setupSectionId ? { 'data-setup-section': setupSectionId } : {})}
      style={{
        bottom: '88px'
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12 }}
    >
      <motion.button
        ref={fabButtonRef}
        onClick={disabled ? undefined : onClick}
        data-tour-target="new-opening-btn"
        className={`bg-primary text-primary-foreground hover:bg-primary/92 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 flex items-center justify-center overflow-hidden transition-colors ${
          disabled ? 'opacity-60 cursor-not-allowed hover:bg-primary' : ''
        }`}
        style={{
          height: 48,
          borderRadius: 12,
          padding: '0 16px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)'
        }}
        animate={{
          width: isCollapsed ? FAB_COLLAPSED_WIDTH : FAB_EXPANDED_WIDTH,
          borderRadius: isCollapsed ? 12 : 12
        }}
        transition={spring}
        aria-label="Add Opening"
        whileHover={disabled ? undefined : { 
          boxShadow: '0 12px 28px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.1)'
        }}
        whileTap={disabled ? undefined : { scale: 0.98 }}
        disabled={disabled}
      >
        <Plus className="h-5 w-5 flex-shrink-0" />
        <motion.span
          animate={{
            opacity: isCollapsed ? 0 : 1,
            x: isCollapsed ? 6 : 0,
            width: isCollapsed ? 0 : 86,
            marginLeft: isCollapsed ? 0 : 8,
          }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="text-sm font-medium whitespace-nowrap overflow-hidden"
          aria-hidden={isCollapsed}
        >
          Add Opening
        </motion.span>
      </motion.button>
    </motion.div>
  );
};
