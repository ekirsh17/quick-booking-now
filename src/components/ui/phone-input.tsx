import * as React from "react";
import PhoneInputWithCountry from "react-phone-number-input";
import "react-phone-number-input/style.css";
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

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, disabled, error, placeholder, className, onBlur, autoFocus, required }, ref) => {
    return (
      <PhoneInputWithCountry
        international
        defaultCountry="US"
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder || "+1 (555) 123-4567"}
        onBlur={onBlur}
        autoFocus={autoFocus}
        className={cn(
          "phone-input-container",
          error && "phone-input-error",
          className
        )}
        numberInputProps={{
          type: "tel",
          inputMode: "tel",
          autoComplete: "tel",
          required,
          "aria-required": required,
          className: cn(
            "flex h-10 w-full rounded-r-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            error && "border-destructive"
          ),
        }}
        style={{
          display: "flex",
          width: "100%",
        }}
      />
    );
  }
);

PhoneInput.displayName = "PhoneInput";
