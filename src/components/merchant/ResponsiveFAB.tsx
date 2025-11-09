import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LucideIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface ResponsiveFABProps {
  onClick: () => void;
  label: string;
  icon: LucideIcon;
  keyboardShortcut?: string;
}

export const ResponsiveFAB = ({
  onClick,
  label,
  icon: Icon,
  keyboardShortcut,
}: ResponsiveFABProps) => {
  const [isFixed, setIsFixed] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) return; // Mobile is always fixed, no need for scroll detection

    const handleScroll = () => {
      if (!buttonRef.current || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Check if the button's original position is below the viewport
      const shouldBeFixed = containerRect.bottom < viewportHeight - 32; // 32px buffer (bottom-8)

      setIsFixed(shouldBeFixed);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Initial check

    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMobile]);

  // Keyboard shortcut handler
  useEffect(() => {
    if (!keyboardShortcut) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Check if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key.toLowerCase() === keyboardShortcut.toLowerCase()) {
        e.preventDefault();
        onClick();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [keyboardShortcut, onClick]);

  const tooltipText = keyboardShortcut
    ? `${label} (Press ${keyboardShortcut.toUpperCase()})`
    : label;

  // Base classes for both states
  const baseClasses =
    "z-50 shadow-2xl transition-all duration-300 ease-in-out";

  // Mobile: Always fixed
  // Desktop: Toggle between absolute (in-flow) and fixed (floating)
  const positionClasses = isMobile
    ? "fixed bottom-24 right-6 h-12 w-12" // Mobile: smaller, always fixed with safe spacing
    : isFixed
    ? "fixed md:bottom-8 md:right-8 h-14 w-14 opacity-100 scale-100" // Desktop: fixed when scrolled
    : "absolute bottom-4 right-4 h-14 w-14 opacity-100 scale-100"; // Desktop: absolute in container

  return (
    <div ref={containerRef} className="relative">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              ref={buttonRef}
              onClick={onClick}
              size="lg"
              className={`${baseClasses} ${positionClasses} flex items-center justify-center`}
              aria-label={label}
            >
              <Icon className={isMobile ? "h-5 w-5" : "h-6 w-6"} />
              {!isMobile && (
                <span className="ml-2 hidden lg:inline">{label}</span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
