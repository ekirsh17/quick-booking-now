import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Compass, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useActivationContext } from '@/contexts/ActivationContext';

export function WelcomeModal() {
  const { showWelcomeModal, handleShowMeAround, handleDismissWelcome } = useActivationContext();

  return (
    <Dialog
      open={showWelcomeModal}
      onOpenChange={(open) => {
        if (!open) void handleDismissWelcome();
      }}
    >
      <DialogPortal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-[80] bg-black/80',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-[50%] top-[50%] z-[80] grid w-[calc(100vw-2rem)] max-w-md translate-x-[-50%] translate-y-[-50%] gap-4',
            'rounded-xl border bg-background p-6 shadow-lg duration-200',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          )}
        >
          <DialogHeader className="items-center space-y-3 text-center sm:items-center sm:text-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10"
              aria-hidden
            >
              <Compass className="h-6 w-6 text-accent" strokeWidth={1.75} />
            </div>
            <DialogTitle>Welcome to your dashboard</DialogTitle>
            <DialogDescription>
              Take a quick tour to see how OpenAlert helps you turn openings into booked appointments
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-stretch">
            <Button
              type="button"
              className="w-full min-h-11 bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent"
              onClick={() => void handleShowMeAround()}
            >
              Show me around
            </Button>
          </DialogFooter>
          <DialogPrimitive.Close
            type="button"
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            onClick={() => void handleDismissWelcome()}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
