import { Button } from '@/components/ui/button';
import { CheckCircle2, Calendar, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompleteStepProps {
  onCreateOpening: () => void;
  onGoToDashboard: () => void;
  isLoading?: boolean;
}

export function CompleteStep({ 
  onCreateOpening, 
  onGoToDashboard,
  isLoading = false
}: CompleteStepProps) {
  return (
    <div className="flex flex-col items-center text-center px-2">
      {/* Success animation */}
      <div className="relative mb-6 animate-in fade-in-0 zoom-in-50 duration-500">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
        </div>
        {/* Confetti dots */}
        <div className="absolute -top-2 -right-2 w-3 h-3 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="absolute -top-1 -left-3 w-2 h-2 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '100ms' }} />
        <div className="absolute -bottom-1 -right-3 w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '200ms' }} />
        <div className="absolute top-2 -left-2 w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
      </div>
      
      {/* Headline */}
      <h1 className="text-2xl font-bold mb-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-100">
        You're all set! 🎉
      </h1>
      <p className="text-muted-foreground mb-8 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-150">
        Your account is ready. Start by posting your first opening.
      </p>
      
      {/* What's next card */}
      <div className="w-full max-w-sm bg-muted/50 rounded-xl p-5 mb-8 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-200">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-medium mb-1">What's next?</p>
            <p className="text-sm text-muted-foreground">
              Post an opening when you have a cancellation or free slot. Customers will get notified instantly.
            </p>
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="w-full space-y-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-300">
        <Button 
          onClick={onCreateOpening} 
          size="lg" 
          className="w-full"
          disabled={isLoading}
        >
          Create First Opening
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        <Button 
          onClick={onGoToDashboard} 
          variant="ghost" 
          size="sm"
          className="text-muted-foreground"
          disabled={isLoading}
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}


