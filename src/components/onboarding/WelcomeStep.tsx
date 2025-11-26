import { Button } from '@/components/ui/button';
import { Bell, Zap, DollarSign } from 'lucide-react';
import notifymeIcon from '@/assets/notifyme-icon.png';

interface WelcomeStepProps {
  onContinue: () => void;
  onSkip: () => void;
}

export function WelcomeStep({ onContinue, onSkip }: WelcomeStepProps) {
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
        Let's get you set up
      </h1>
      <p className="text-muted-foreground mb-8 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-150">
        Just 60 seconds and you're ready to go
      </p>
      
      {/* Value propositions */}
      <div className="space-y-4 w-full max-w-sm mb-8">
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 animate-in fade-in-0 slide-in-from-left-4 duration-500 delay-200">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-medium">Post last-minute openings</p>
            <p className="text-sm text-muted-foreground">Customer canceled? Post in seconds</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 animate-in fade-in-0 slide-in-from-left-4 duration-500 delay-300">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-medium">Customers get notified instantly</p>
            <p className="text-sm text-muted-foreground">SMS alerts, no app needed</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 animate-in fade-in-0 slide-in-from-left-4 duration-500 delay-[400ms]">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-medium">Fill empty slots, earn more</p>
            <p className="text-sm text-muted-foreground">Turn cancellations into revenue</p>
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="w-full space-y-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-500">
        <Button 
          onClick={onContinue} 
          size="lg" 
          className="w-full"
        >
          Get Started
        </Button>
        <Button 
          onClick={onSkip} 
          variant="ghost" 
          size="sm"
          className="text-muted-foreground"
        >
          Skip setup for now
        </Button>
      </div>
    </div>
  );
}


