import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PartyPopper, CreditCard, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface FirstOpeningCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
}

const DISMISSAL_KEY = 'first-opening-celebration-dismissed';

export function useFirstOpeningCelebration() {
  const [isOpen, setIsOpen] = useState(false);
  
  const wasDismissed = () => {
    try {
      return localStorage.getItem(DISMISSAL_KEY) === 'true';
    } catch {
      return false;
    }
  };
  
  const showCelebration = () => {
    if (!wasDismissed()) {
      setIsOpen(true);
    }
  };
  
  const dismissCelebration = () => {
    try {
      localStorage.setItem(DISMISSAL_KEY, 'true');
    } catch {
      // localStorage unavailable
    }
    setIsOpen(false);
  };
  
  return {
    isOpen,
    showCelebration,
    dismissCelebration,
  };
}

export function FirstOpeningCelebration({ isOpen, onClose }: FirstOpeningCelebrationProps) {
  const navigate = useNavigate();
  
  const handleAddPayment = () => {
    onClose();
    navigate('/merchant/billing');
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        
        <DialogHeader className="text-center pt-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <PartyPopper className="h-8 w-8 text-emerald-600" />
          </div>
          <DialogTitle className="text-2xl font-bold">
            You filled your first opening!
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            OpenAlert just helped you book a customer. That's real value!
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">What's next?</strong> Add a payment method now to ensure 
              uninterrupted service when your trial ends. You won't be charged until then.
            </p>
          </div>
          
          <div className="flex flex-col gap-3">
            <Button onClick={handleAddPayment} size="lg" className="w-full">
              <CreditCard className="mr-2 h-4 w-4" />
              Add Payment Method
            </Button>
            
            <Button variant="ghost" onClick={onClose} className="w-full text-muted-foreground">
              Not now, I'll do it later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FirstOpeningCelebration;

