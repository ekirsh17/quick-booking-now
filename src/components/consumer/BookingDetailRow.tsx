import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Matches settings / onboarding detail rows (e.g. SettingsSection). */
export const bookingDetailIconClassName = "mt-0.5 h-5 w-5 shrink-0 text-primary";

interface BookingDetailRowProps {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function BookingDetailRow({ icon: Icon, label, children, className }: BookingDetailRowProps) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <Icon className={bookingDetailIconClassName} aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-medium leading-snug">{label}</p>
        {children}
      </div>
    </div>
  );
}
