import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { getFloatingCoachClasses } from '@/components/merchant/coachmarks/floatingPanelPosition';

interface FloatingCoachCardProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode;
  variant?: 'panel' | 'tour-panel';
}

export function FloatingCoachCard({
  id,
  className,
  children,
  variant = 'panel',
  ...props
}: FloatingCoachCardProps) {
  return (
    <div
      id={id}
      className={cn(
        getFloatingCoachClasses(variant),
        'rounded-xl border bg-card shadow-2xl ring-1 ring-border/60',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
