import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SetupProgressRingProps {
  completed: number;
  total: number;
  size?: number;
  className?: string;
  /** Use on accent (orange) backgrounds */
  onAccent?: boolean;
}

export function SetupProgressRing({
  completed,
  total,
  size = 36,
  className,
  onAccent = false,
}: SetupProgressRingProps) {
  const safeTotal = Math.max(total, 1);
  const clampedCompleted = Math.min(Math.max(completed, 0), safeTotal);
  const isComplete = clampedCompleted >= safeTotal;
  const isEmpty = clampedCompleted === 0;

  const strokeWidth = size <= 28 ? 2 : size <= 32 ? 2.5 : 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = clampedCompleted / safeTotal;
  const dashOffset = circumference * (1 - progress);

  const hasProgress = clampedCompleted > 0;
  const trackClass = onAccent
    ? 'stroke-accent-foreground/35'
    : 'stroke-muted-foreground/40';
  const progressClass = onAccent ? 'stroke-accent-foreground' : 'stroke-accent';
  const labelClass = onAccent
    ? 'text-accent-foreground'
    : isEmpty
      ? 'text-muted-foreground'
      : 'text-foreground';
  const fractionTextSize =
    size >= 36 ? 'text-[10px]' : size >= 30 ? 'text-[9px]' : 'text-[8px]';
  const fractionWeight = size <= 30 ? 'font-medium' : 'font-semibold';
  const checkIconClass =
    size <= 28 ? 'h-3 w-3' : size <= 32 ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={trackClass}
          strokeWidth={strokeWidth}
        />
        {hasProgress ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            className={cn(progressClass, 'transition-[stroke-dashoffset] duration-300')}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={isComplete ? 0 : dashOffset}
          />
        ) : null}
      </svg>
      {isComplete ? (
        <Check className={cn('absolute', checkIconClass, labelClass)} strokeWidth={2.5} />
      ) : (
        <span
          className={cn(
            'absolute tabular-nums leading-none',
            fractionWeight,
            fractionTextSize,
            labelClass
          )}
        >
          {clampedCompleted}/{safeTotal}
        </span>
      )}
    </span>
  );
}
