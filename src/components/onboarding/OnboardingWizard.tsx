import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { OnboardingProgress } from './OnboardingProgress';
import { WelcomeStep } from './WelcomeStep';
import { TimezoneStep } from './TimezoneStep';
import { ServicesStep } from './ServicesStep';
import { CompleteStep } from './CompleteStep';
import { useOnboarding } from '@/hooks/useOnboarding';
import { cn } from '@/lib/utils';

export function OnboardingWizard() {
  const navigate = useNavigate();
  const {
    currentStep,
    timezone,
    isLoading,
    setTimezone,
    nextStep,
    prevStep,
    skipOnboarding,
    completeOnboarding,
  } = useOnboarding();

  const handleCreateOpening = async () => {
    await completeOnboarding();
    // After completing, navigate to openings with modal trigger
    navigate('/merchant/openings?action=create');
  };

  const handleGoToDashboard = async () => {
    await completeOnboarding();
  };

  if (isLoading && currentStep === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <Card className="w-full max-w-md p-8">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md overflow-hidden">
        {/* Progress indicator */}
        {currentStep > 1 && currentStep < 4 && (
          <div className="px-6 pt-4">
            <OnboardingProgress currentStep={currentStep} />
          </div>
        )}
        
        {/* Step content */}
        <div 
          className={cn(
            "p-6 min-h-[420px] flex flex-col",
            currentStep === 1 && "pt-8"
          )}
        >
          {currentStep === 1 && (
            <WelcomeStep 
              onContinue={nextStep}
              onSkip={skipOnboarding}
            />
          )}
          
          {currentStep === 2 && (
            <TimezoneStep
              timezone={timezone}
              onTimezoneChange={setTimezone}
              onContinue={nextStep}
              onBack={prevStep}
            />
          )}
          
          {currentStep === 3 && (
            <ServicesStep
              onContinue={nextStep}
              onBack={prevStep}
            />
          )}
          
          {currentStep === 4 && (
            <CompleteStep
              onCreateOpening={handleCreateOpening}
              onGoToDashboard={handleGoToDashboard}
              isLoading={isLoading}
            />
          )}
        </div>
      </Card>
    </div>
  );
}


