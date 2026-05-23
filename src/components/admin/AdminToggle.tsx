import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  User, 
  ShoppingBag, 
  Calendar,
  BarChart3,
  UserCircle,
  LogIn,
  Home,
  Bell,
  CheckCircle,
  Clipboard,
  GraduationCap,
  ListChecks,
  RotateCcw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  enableSetupChecklistPreview,
  resetSetupProgressInDatabase,
} from '@/lib/setupChecklistAdmin';

export const AdminToggle = () => {
  const { isAdminMode, refreshTestData, testMerchantId, availableSlots } = useAdmin();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [setupResetting, setSetupResetting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Refresh test data when dialog opens
  useEffect(() => {
    if (isAdminMode && isOpen) {
      refreshTestData();
    }
  }, [isAdminMode, isOpen, refreshTestData]);

  if (!isAdminMode) return null;

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  const openSetupChecklistPreview = (options?: { resetDatabase?: boolean }) => {
    const run = async () => {
      if (options?.resetDatabase) {
        if (!user?.id) {
          toast({
            title: 'Sign in required',
            description: 'Log in as a merchant to reset setup progress in the database.',
            variant: 'destructive',
          });
          return;
        }
        setSetupResetting(true);
        try {
          await resetSetupProgressInDatabase(user.id);
        } catch (error) {
          console.error('Failed to reset setup progress:', error);
          toast({
            title: 'Reset failed',
            description: 'Could not clear setup timestamps on your profile.',
            variant: 'destructive',
          });
          return;
        } finally {
          setSetupResetting(false);
        }
      }

      enableSetupChecklistPreview();
      navigate('/merchant/openings?setupChecklist=preview');
      setIsOpen(false);
      toast({
        title: options?.resetDatabase ? 'Setup progress reset' : 'Setup checklist preview',
        description: options?.resetDatabase
          ? 'Welcome modal and all checklist steps are shown as incomplete for this session.'
          : 'Checklist shows every step as incomplete for this browser session.',
      });
    };

    void run();
  };

  const handleConsumerFlow = (path: string, requiresMerchant = false, requiresSlot = false) => {
    if (requiresMerchant && !testMerchantId) {
      toast({
        title: "No Test Merchant",
        description: "Create a merchant account first to test consumer flows",
        variant: "destructive"
      });
      return;
    }
    if (requiresSlot && availableSlots.length === 0) {
      toast({
        title: "No Available Slots",
        description: "Create a slot in the merchant dashboard first",
        variant: "destructive"
      });
      return;
    }
    navigate(path);
    setIsOpen(false);
  };

  const buttonClass = "w-full justify-start text-left h-9";

  return (
    <>
      {/* Floating Admin Tab */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-card shadow-2xl rounded-l-lg border-l border-y hover:bg-accent/10 transition-colors"
        style={{ width: '36px', height: '140px' }}
        aria-label="Open admin panel"
      >
        <div className="flex flex-col items-center justify-center h-full gap-2">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="vertical-text text-[10px] font-semibold tracking-wider">ADMIN</span>
        </div>
      </button>

      {/* Admin Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              Admin Panel
            </DialogTitle>
          </DialogHeader>

          {/* Two-column layout on md+, stacked on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Merchant Views Column */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Merchant Views</h4>
              </div>
              <Button
                size="sm"
                variant="outline"
                className={buttonClass}
                onClick={() => handleNavigate('/')}
              >
                <Home className="h-3.5 w-3.5 mr-2" />
                Home
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={buttonClass}
                onClick={() => handleNavigate('/merchant/onboarding?force=true&step=1&reset=true')}
              >
                <GraduationCap className="h-3.5 w-3.5 mr-2" />
                Onboarding Flow
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={buttonClass}
                onClick={() => handleNavigate('/merchant/openings?tutorial=reset')}
              >
                <GraduationCap className="h-3.5 w-3.5 mr-2" />
                Tutorial
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={buttonClass}
                onClick={() => openSetupChecklistPreview()}
              >
                <ListChecks className="h-3.5 w-3.5 mr-2" />
                Setup checklist (preview)
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={buttonClass}
                disabled={setupResetting}
                onClick={() => openSetupChecklistPreview({ resetDatabase: true })}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-2" />
                {setupResetting ? 'Resetting setup…' : 'Reset setup + checklist'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={buttonClass}
                onClick={() => handleNavigate('/merchant/login?force=true')}
              >
                <LogIn className="h-3.5 w-3.5 mr-2" />
                Login
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={buttonClass}
                onClick={() => handleNavigate('/merchant/openings')}
              >
                <Calendar className="h-3.5 w-3.5 mr-2" />
                Openings
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={buttonClass}
                onClick={() => handleNavigate('/merchant/analytics')}
              >
                <BarChart3 className="h-3.5 w-3.5 mr-2" />
                Reporting
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={buttonClass}
                onClick={() => handleNavigate('/merchant/settings')}
              >
                <UserCircle className="h-3.5 w-3.5 mr-2" />
                Settings
              </Button>
            </div>

            {/* Consumer Flows Column */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Consumer Flows</h4>
              </div>
              <Button
                size="sm"
                variant="outline"
                className={buttonClass}
                onClick={() => handleNavigate('/consumer/sign-in')}
              >
                <LogIn className="h-3.5 w-3.5 mr-2" />
                Login
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={buttonClass}
                onClick={() => handleConsumerFlow(`/notify/${testMerchantId}`, true)}
              >
                <Bell className="h-3.5 w-3.5 mr-2" />
                Notify Me
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={buttonClass}
                onClick={() => handleConsumerFlow(`/claim/${availableSlots[0]?.id}`, false, true)}
              >
                <Clipboard className="h-3.5 w-3.5 mr-2" />
                Claim Slot
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={buttonClass}
                onClick={() => handleConsumerFlow(`/booking-confirmed/${availableSlots[0]?.id}`, false, true)}
              >
                <CheckCircle className="h-3.5 w-3.5 mr-2" />
                Booking Confirmation
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={buttonClass}
                onClick={() => handleNavigate('/my-notifications')}
              >
                <Bell className="h-3.5 w-3.5 mr-2" />
                My Notifications
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
