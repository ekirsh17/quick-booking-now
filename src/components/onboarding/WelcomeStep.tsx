import { Button } from '@/components/ui/button';
import { Bell, Smartphone, DollarSign } from 'lucide-react';
import notifymeIcon from '@/assets/notifyme-icon.png';

interface WelcomeStepProps {
  onContinue: () => void;
}

export function WelcomeStep({ onContinue }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center text-center px-2">
      {/* Logo */}
      <div className="w-16 h-16 mb-6 animate-in fade-in-0 zoom-in-95 duration-500">
        <img 
          src={notifymeIcon} 
          alt="NotifyMe" 
          className="w-full h-full object-contain rounded-xl shadow-lg"
        />
      </div>
      
      {/* Headline */}
      <h1 className="text-2xl font-bold mb-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-100">
        Fill last-minute cancellations automatically
      </h1>
      <p className="text-muted-foreground mb-8 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-150">
        Text us your openings. We'll text your customers.
      </p>
      
      {/* Value propositions */}
      <div className="space-y-4 w-full max-w-sm mb-8">
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 animate-in fade-in-0 slide-in-from-left-4 duration-500 delay-200">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-medium">Text us your openings</p>
            <p className="text-sm text-muted-foreground">AI understands "add 2pm" or "haircut at 3"</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 animate-in fade-in-0 slide-in-from-left-4 duration-500 delay-300">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-medium">Customers notified instantly</p>
            <p className="text-sm text-muted-foreground">SMS alerts to your waitlist</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 animate-in fade-in-0 slide-in-from-left-4 duration-500 delay-[400ms]">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-medium">Turn cancellations into revenue</p>
            <p className="text-sm text-muted-foreground">Fill slots that would've stayed empty</p>
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="w-full animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-500">
        <Button 
          onClick={onContinue} 
          size="lg" 
          className="w-full"
        >
          Get Started
        </Button>
        
        {/* Trust-building trial note */}
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Free trial — no payment required until you see real value.
        </p>
      </div>
    </div>
  );
}


