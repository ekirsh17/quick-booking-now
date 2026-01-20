import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

interface AddOpeningCTAProps {
  onClick: () => void;
  variant?: 'auto' | 'fab' | 'inline';
  className?: string;
  disabled?: boolean;
}

export const AddOpeningCTA = ({ 
  onClick, 
  variant = 'auto',
  className = '',
  disabled = false,
}: AddOpeningCTAProps) => {
  const isMobile = useIsMobile();
  const [scrollY, setScrollY] = useState(0);
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | 'idle'>('idle');
  const [lastScrollY, setLastScrollY] = useState(0);

  // Track scroll position and direction
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 64) {
        setScrollDirection('down');
      } else if (currentScrollY < lastScrollY) {
        setScrollDirection('up');
      } else if (currentScrollY <= 64) {
        setScrollDirection('idle');
      }
      
      setScrollY(currentScrollY);
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Determine if we should show collapsed FAB
  const isCollapsed = scrollDirection === 'down' && scrollY > 64;

  // Auto variant: choose based on screen size
  const effectiveVariant = variant === 'auto' 
    ? (isMobile ? 'fab' : 'inline')
    : variant;

  // Desktop/Tablet inline button (rendered in header)
  if (effectiveVariant === 'inline') {
    return (
      <Button
        onClick={disabled ? undefined : onClick}
        size="default"
        className={`h-9 shadow-sm hover:shadow-md transition-shadow ${className}`}
        aria-label="Add Opening"
        disabled={disabled}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Opening
      </Button>
    );
  }

  // Mobile Extended FAB
  const spring = {
    type: "spring" as const,
    stiffness: 400,
    damping: 28
  };

  return (
    <motion.div
      className="fixed right-4 z-40"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 80px)'
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12 }}
    >
      <motion.button
        onClick={disabled ? undefined : onClick}
        className={`bg-primary text-primary-foreground hover:bg-primary/92 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 flex items-center justify-center gap-2 transition-colors ${
          disabled ? 'opacity-60 cursor-not-allowed hover:bg-primary' : ''
        }`}
        style={{
          height: 48,
          borderRadius: 12,
          padding: isCollapsed ? '0' : '0 16px',
          minWidth: 48,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)'
        }}
        animate={{
          width: isCollapsed ? 48 : 'auto',
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
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.16 }}
              className="text-sm font-medium whitespace-nowrap overflow-hidden"
            >
              Add Opening
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </motion.div>
  );
};
