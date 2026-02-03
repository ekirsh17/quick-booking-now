import { Card } from '@/components/ui/card';
import { OnboardingProgress } from './OnboardingProgress';
import { BusinessDetailsStep } from './BusinessDetailsStep';
import { LocationDetailsStep } from './LocationDetailsStep';
import { CompleteStep } from './CompleteStep';
import { BusinessProfileStep } from './BusinessProfileStep';
import { useOnboarding } from '@/hooks/useOnboarding';
import { cn } from '@/lib/utils';

export function OnboardingWizard() {
  const {
    currentStep,
    businessName,
    email,
    smsConsent,
    locationName,
    locationAddress,
    locationPhone,
    businessType,
    businessTypeOther,
    weeklyAppointments,
    teamSize,
    seatsCount,
    billingCadence,
    timezone,
    staffFirstName,
    staffLastName,
    staffNameError,
    isLoading,
    trialInfo,
    planPricing,
    setBusinessName,
    setEmail,
    setSmsConsent,
    setLocationName,
    setLocationAddress,
    setLocationPhone,
    setBusinessType,
    setBusinessTypeOther,
    setWeeklyAppointments,
    setTeamSize,
    setSeatsCount,
    setBillingCadence,
    setTimezone,
    setStaffFirstName,
    setStaffLastName,
    nextStep,
    prevStep,
    completeOnboarding,
  } = useOnboarding();

  const handleComplete = async () => {
    await completeOnboarding();
  };

  if (isLoading && currentStep === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <Card className="w-full max-w-md md:max-w-lg p-8">
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
      <Card className="w-full max-w-md md:max-w-lg overflow-hidden">
        {/* Progress indicator - show for steps 1-3 */}
        {currentStep < 4 && (
          <div className="px-6 pt-4">
            <OnboardingProgress currentStep={currentStep} totalSteps={4} />
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
            <BusinessDetailsStep
              businessName={businessName}
              email={email}
              smsConsent={smsConsent}
              onBusinessNameChange={setBusinessName}
              onEmailChange={setEmail}
              onSmsConsentChange={setSmsConsent}
              onContinue={nextStep}
              onBack={prevStep}
              showBack={false}
              isLoading={isLoading}
            />
          )}
          
          {currentStep === 2 && (
            <LocationDetailsStep
              locationName={locationName}
              locationAddress={locationAddress}
              locationPhone={locationPhone}
              timezone={timezone}
              onLocationNameChange={setLocationName}
              onLocationAddressChange={setLocationAddress}
              onLocationPhoneChange={setLocationPhone}
              onTimezoneChange={setTimezone}
              onContinue={nextStep}
              onBack={prevStep}
              isLoading={isLoading}
            />
          )}

          {currentStep === 3 && (
            <BusinessProfileStep
              businessType={businessType}
              businessTypeOther={businessTypeOther}
              weeklyAppointments={weeklyAppointments}
              teamSize={teamSize}
              onBusinessTypeChange={setBusinessType}
              onBusinessTypeOtherChange={setBusinessTypeOther}
              onWeeklyAppointmentsChange={setWeeklyAppointments}
              onTeamSizeChange={setTeamSize}
              onContinue={nextStep}
              onBack={prevStep}
              isLoading={isLoading}
            />
          )}
          
          {currentStep === 4 && (
            <CompleteStep
              onContinue={handleComplete}
              isLoading={isLoading}
              trialInfo={trialInfo}
              planPricing={planPricing}
              teamSize={teamSize}
              seatsCount={seatsCount}
              onSeatsChange={setSeatsCount}
              billingCadence={billingCadence}
              onBillingCadenceChange={setBillingCadence}
              staffFirstName={staffFirstName}
              staffLastName={staffLastName}
              staffNameError={staffNameError}
              onStaffFirstNameChange={setStaffFirstName}
              onStaffLastNameChange={setStaffLastName}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
