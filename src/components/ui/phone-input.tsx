import * as React from "react";
import PhoneInputWithCountry, { getCountryCallingCode } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PhoneInputProps {
  value: string;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
  error?: boolean;
  placeholder?: string;
  className?: string;
  onBlur?: () => void;
  autoFocus?: boolean;
  required?: boolean;
}

interface CountryCodeSelectProps {
  value?: string;
  onChange: (value?: string) => void;
  options: Array<{ value?: string; label: string; divider?: boolean }>;
  iconComponent: React.ComponentType<{ country: string; label: string }>;
  disabled?: boolean;
}

const CountryCodeSelect = ({
  value,
  onChange,
  options,
  iconComponent: FlagIcon,
  disabled,
}: CountryCodeSelectProps) => {
  let callingCode: string | null = null;
  try {
    callingCode = value ? String(getCountryCallingCode(value as any)) : null;
  } catch {
    callingCode = null;
  }

  return (
    <div
      className={cn(
        "relative flex items-center gap-1.5 h-10 px-2.5 min-w-[72px]",
        "rounded-l-md border border-input",
        "bg-background text-foreground",
        "hover:bg-muted/50 transition-colors",
        "[&]:[-webkit-tap-highlight-color:transparent]",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <div className="flex items-center gap-1.5 pointer-events-none select-none">
        {value ? (
          <FlagIcon country={value} label={value} />
        ) : (
          <span className="w-5 h-[15px] bg-muted rounded-sm flex-shrink-0" />
        )}
        <span className="text-sm font-medium tabular-nums leading-none">
          {callingCode ? `+${callingCode}` : "—"}
        </span>
        <ChevronDown className="h-3 w-3 opacity-40 flex-shrink-0" />
      </div>

      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        disabled={disabled}
        aria-label="Select country code"
        tabIndex={0}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
        style={{ WebkitAppearance: "none", fontSize: "16px" }}
      >
        {options.map((opt) => {
          if (opt.divider || !opt.value) return null;
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          );
        })}
      </select>
    </div>
  );
};

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, disabled, error, placeholder, className, onBlur, autoFocus, required }, ref) => {
    return (
      <div
        className={cn(
          "flex w-full rounded-md ring-offset-background",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          className
        )}
      >
        <PhoneInputWithCountry
          defaultCountry="US"
          international={false}
          countrySelectComponent={CountryCodeSelect}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder || "(555) 123-4567"}
          onBlur={onBlur}
          autoFocus={autoFocus}
          className={cn(
            "phone-input-container",
            error && "phone-input-error"
          )}
          numberInputProps={{
            type: "tel",
            inputMode: "tel",
            autoComplete: "tel",
            required,
            "aria-required": required,
            className: cn(
              "flex h-10 w-full rounded-r-md border border-l-0 border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              error && "border-destructive"
            ),
          }}
          style={{
            display: "flex",
            width: "100%",
          }}
        />
      </div>
    );
  }
);

PhoneInput.displayName = "PhoneInput";
