import { cn } from '@/lib/utils';
import { OnboardingStep } from '@/types/onboarding';

interface OnboardingProgressProps {
  currentStep: OnboardingStep;
  totalSteps?: number;
}

export function OnboardingProgress({ 
  currentStep, 
  totalSteps = 4 
}: OnboardingProgressProps) {
  return (
    <div className="flex items-center justify-center gap-2 py-4" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={totalSteps}>
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
        <div
          key={step}
          className={cn(
            "w-2.5 h-2.5 rounded-full transition-all duration-300",
            step === currentStep
              ? "bg-primary w-6"
              : step < currentStep
              ? "bg-primary"
              : "bg-muted"
          )}
          aria-label={`Step ${step} of ${totalSteps}${step === currentStep ? ' (current)' : step < currentStep ? ' (completed)' : ''}`}
        />
      ))}
    </div>
  );
}
