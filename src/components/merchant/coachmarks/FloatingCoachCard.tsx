import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { getFloatingCoachPanelClasses } from '@/components/merchant/coachmarks/floatingPanelPosition';

interface FloatingCoachCardProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode;
}

export function FloatingCoachCard({ id, className, children, ...props }: FloatingCoachCardProps) {
  return (
    <div
      id={id}
      className={cn(
        getFloatingCoachPanelClasses(),
        'oa-floating-coach-panel rounded-xl border bg-card shadow-2xl ring-1 ring-border/60',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
