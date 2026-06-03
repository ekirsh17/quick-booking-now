import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  RotateCcw,
  MapPin,
  List,
  QrCode,
  Rocket,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  enableSetupChecklistPreview,
  resetSetupProgressInDatabase,
} from '@/lib/setupChecklistAdmin';
import {
  buildLocationSelectorPath,
  buildNotifyMePath,
  fetchMerchantConsumerLinks,
} from '@/lib/adminConsumerLinks';

export const AdminToggle = () => {
  const { isAdminMode, refreshTestData, testMerchantId } = useAdmin();
  const { user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [setupResetting, setSetupResetting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  /** Prefer logged-in merchant on /merchant/* so claim links match the openings you see. */
  const resolveAdminMerchantId = useCallback((): string | null => {
    if (location.pathname.startsWith('/merchant') && user?.id) {
      return user.id;
    }
    return testMerchantId;
  }, [location.pathname, testMerchantId, user?.id]);

  useEffect(() => {
    if (isAdminMode && isOpen) {
      const merchantId = resolveAdminMerchantId();
      if (merchantId) {
        void refreshTestData(merchantId);
      }
    }
  }, [isAdminMode, isOpen, refreshTestData, resolveAdminMerchantId]);

  if (!isAdminMode) return null;

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  const resetSetupAndChecklist = () => {
    const run = async () => {
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

      enableSetupChecklistPreview();
      navigate('/merchant/openings?setupChecklist=preview');
      setIsOpen(false);
      toast({
        title: 'Setup progress reset',
        description: 'Welcome modal and all checklist steps are shown as incomplete for this session.',
      });
    };

    void run();
  };

  const requireTestMerchant = (): string | null => {
    const merchantId = resolveAdminMerchantId();
    if (!merchantId) {
      toast({
        title: 'No Test Merchant',
        description: 'Log in as a merchant or open a consumer test route first',
        variant: 'destructive',
      });
      return null;
    }
    return merchantId;
  };

  const handleNotifyMePreview = async () => {
    const merchantId = requireTestMerchant();
    if (!merchantId) return;

    const links = await fetchMerchantConsumerLinks(merchantId);
    const path = buildNotifyMePath(links, merchantId);

    if (!path) {
      toast({
        title: 'No waitlist link',
        description: 'Set a custom handle or location waitlist link for this merchant first',
        variant: 'destructive',
      });
      return;
    }

    navigate(path);
    setIsOpen(false);
  };

  const handleLocationSelectorPreview = async () => {
    const merchantId = requireTestMerchant();
    if (!merchantId) return;

    const links = await fetchMerchantConsumerLinks(merchantId);
    const path = buildLocationSelectorPath(links);

    if (!path) {
      toast({
        title: 'No custom handle',
        description: 'Set a custom waitlist link for this merchant first',
        variant: 'destructive',
      });
      return;
    }

    navigate(path);
    setIsOpen(false);
  };

  const handleSlotConsumerFlow = async (pathBuilder: (slotId: string) => string) => {
    const merchantId = requireTestMerchant();
    if (!merchantId) return;

    const slots = await refreshTestData(merchantId);
    if (slots.length === 0) {
      toast({
        title: 'No claimable openings',
        description:
          'Need a future opening that is still open (not booked). Create one on Openings, or sign in as that merchant.',
        variant: 'destructive',
      });
      return;
    }
    navigate(pathBuilder(slots[0].id));
    setIsOpen(false);
  };

  const buttonClass = 'w-full justify-start text-left h-9';

  return (
    <>
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

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              Admin Panel
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Merchant Views
                </h4>
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
                <Rocket className="h-3.5 w-3.5 mr-2" />
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
                disabled={setupResetting}
                onClick={() => resetSetupAndChecklist()}
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
                onClick={() => handleNavigate('/merchant/waitlist')}
              >
                <List className="h-3.5 w-3.5 mr-2" />
                Waitlist
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={buttonClass}
                onClick={() => handleNavigate('/merchant/qr-code')}
              >
                <QrCode className="h-3.5 w-3.5 mr-2" />
                QR Code
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

            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Consumer Flows
                </h4>
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
                onClick={() => void handleNotifyMePreview()}
              >
                <Bell className="h-3.5 w-3.5 mr-2" />
                Notify Me
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={buttonClass}
                onClick={() => void handleLocationSelectorPreview()}
              >
                <MapPin className="h-3.5 w-3.5 mr-2" />
                Location selector
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={buttonClass}
                onClick={() => void handleSlotConsumerFlow((slotId) => `/claim/${slotId}`)}
              >
                <Clipboard className="h-3.5 w-3.5 mr-2" />
                Claim Slot
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={buttonClass}
                onClick={() =>
                  void handleSlotConsumerFlow((slotId) => `/booking-confirmed/${slotId}`)
                }
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
