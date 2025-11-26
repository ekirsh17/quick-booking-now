import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

/**
 * Reusable settings section component for consistent layout across settings page.
 * Follows NotifyMe design patterns: Card with p-6 padding, consistent typography.
 */
export function SettingsSection({
  title,
  description,
  icon: Icon,
  children,
  className,
  headerAction,
}: SettingsSectionProps) {
  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-primary" />
            </div>
          )}
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        </div>
        {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
      </div>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

/**
 * A single setting row with label, optional description, and control.
 */
interface SettingsRowProps {
  label: string;
  description?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingsRow({
  label,
  description,
  htmlFor,
  children,
  className,
}: SettingsRowProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-3', className)}>
      <div className="flex-1 min-w-0">
        <label htmlFor={htmlFor} className="font-medium text-sm">
          {label}
        </label>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

/**
 * A toggle setting row with switch control.
 */
interface SettingsToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function SettingsToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: SettingsToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{label}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">
        <button
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onCheckedChange(!checked)}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            checked ? 'bg-primary' : 'bg-input'
          )}
        >
          <span
            className={cn(
              'inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition-transform',
              checked ? 'translate-x-5' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>
    </div>
  );
}

/**
 * Divider for separating groups within a section.
 */
export function SettingsDivider() {
  return <div className="border-t my-4" />;
}

/**
 * Subsection header for grouping related settings.
 */
interface SettingsSubsectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsSubsection({ title, description, children }: SettingsSubsectionProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

