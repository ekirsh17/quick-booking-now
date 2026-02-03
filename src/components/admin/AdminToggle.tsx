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
  GraduationCap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const AdminToggle = () => {
  const { isAdminMode, refreshTestData, testMerchantId, availableSlots } = useAdmin();
  const [isOpen, setIsOpen] = useState(false);
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
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-card shadow-2xl rounded-l-lg border-l border-y hover:bg-accent/50 transition-colors"
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
