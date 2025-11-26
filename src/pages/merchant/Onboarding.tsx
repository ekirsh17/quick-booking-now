import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useAuth } from '@/hooks/useAuth';

const Onboarding = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { needsOnboarding, isLoading: onboardingLoading } = useOnboarding();

  // Check for admin force param to bypass redirect (for testing)
  const searchParams = new URLSearchParams(location.search);
  const forceShow = searchParams.get('force') === 'true';

  // Redirect if user doesn't need onboarding (unless force=true for admin testing)
  useEffect(() => {
    if (!forceShow && !authLoading && !onboardingLoading && needsOnboarding === false) {
      navigate('/merchant/openings', { replace: true });
    }
  }, [forceShow, authLoading, onboardingLoading, needsOnboarding, navigate]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/merchant/login', { replace: true });
    }
  }, [authLoading, user, navigate]);

  // Show loading state while checking
  if (authLoading || onboardingLoading || needsOnboarding === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If user doesn't need onboarding and not forcing, don't render anything (will redirect)
  if (needsOnboarding === false && !forceShow) {
    return null;
  }

  return <OnboardingWizard />;
};

export default Onboarding;


