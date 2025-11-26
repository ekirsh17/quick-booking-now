import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { Button } from '@/components/ui/button';
import { 
  ChevronDown, 
  X, 
  User, 
  ShoppingBag, 
  FlaskConical,
  Calendar,
  BarChart3,
  UserCircle,
  LogIn,
  Home,
  Bell,
  CheckCircle,
  Clipboard
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AdminPanelContentProps {
  onClose: () => void;
  isMobile?: boolean;
}

/**
 * Shared panel content component used by both mobile and desktop admin panels.
 * Consolidates all admin navigation and testing tools in one place.
 */
const AdminPanelContent = ({ onClose, isMobile = false }: AdminPanelContentProps) => {
  const { testMerchantId, availableSlots } = useAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();

  const buttonClass = isMobile ? "w-full justify-start touch-feedback" : "w-full justify-start";

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
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
    onClose();
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="font-semibold text-sm">Admin Panel</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close admin panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-6">
        {/* Merchant Views Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Merchant Views</h4>
          </div>
          <Button
            size="sm"
            variant="outline"
            className={buttonClass}
            onClick={() => handleNavigate('/merchant/login')}
          >
            <LogIn className="h-3.5 w-3.5 mr-2" />
            Merchant Login
          </Button>
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
            Account
          </Button>
        </div>

        {/* Consumer Flows Section */}
        <div className="space-y-2 border-t pt-4">
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
            Consumer Sign In
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={buttonClass}
            onClick={() => handleConsumerFlow(`/notify/${testMerchantId}`, true)}
          >
            <Bell className="h-3.5 w-3.5 mr-2" />
            1. Notify Me
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={buttonClass}
            onClick={() => handleConsumerFlow(`/claim/${availableSlots[0]?.id}`, false, true)}
          >
            <Clipboard className="h-3.5 w-3.5 mr-2" />
            2. Claim Slot
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={buttonClass}
            onClick={() => handleConsumerFlow(`/booking-confirmed/${availableSlots[0]?.id}`, false, true)}
          >
            <CheckCircle className="h-3.5 w-3.5 mr-2" />
            3. Booking Confirmation
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

        {/* Testing Tools Section */}
        <div className="space-y-2 border-t pt-4">
          <div className="flex items-center gap-2 mb-3">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Testing Tools</h4>
          </div>
          <div className="space-y-3">
            <div>
              <Button
                size="sm"
                variant="secondary"
                className={buttonClass}
                onClick={() => handleNavigate('/merchant/onboarding?force=true')}
              >
                Start Onboarding Flow
              </Button>
              <p className="text-xs text-muted-foreground mt-1.5 px-1">
                Internal-only: Test the merchant onboarding experience
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AdminToggle = () => {
  const { isAdminMode, refreshTestData } = useAdmin();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  // Refresh test data when panel opens
  useEffect(() => {
    if (isAdminMode && (isExpanded || isMobileExpanded)) {
      refreshTestData();
    }
  }, [isAdminMode, isExpanded, isMobileExpanded, refreshTestData]);

  if (!isAdminMode) return null;

  return (
    <>
      {/* Mobile Edge-Mounted Panel */}
      <div className="lg:hidden">
        {/* Collapsed Tab */}
        {!isMobileExpanded && (
          <button
            onClick={() => setIsMobileExpanded(true)}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-card shadow-2xl rounded-l-lg border-l border-y touch-feedback"
            style={{ width: '32px', height: '128px' }}
            aria-label="Open admin panel"
          >
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="vertical-text text-[10px] font-semibold tracking-wider">ADMIN</span>
            </div>
          </button>
        )}

        {/* Expanded Panel */}
        {isMobileExpanded && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[55]"
              onClick={() => setIsMobileExpanded(false)}
            />
            
            {/* Panel Content */}
            <div className="fixed right-0 top-0 bottom-0 w-72 bg-card shadow-2xl z-[55] border-l overflow-y-auto">
              <AdminPanelContent 
                onClose={() => setIsMobileExpanded(false)} 
                isMobile={true}
              />
            </div>
          </>
        )}
      </div>

      {/* Desktop Right-Side Floating Tab */}
      <div className="hidden lg:block">
        {/* Collapsed Tab */}
        {!isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-card shadow-2xl rounded-l-lg border-l border-y hover:bg-accent/50 transition-colors"
            style={{ width: '40px', height: '160px' }}
            aria-label="Open admin panel"
          >
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="vertical-text text-xs font-semibold tracking-wider">ADMIN</span>
            </div>
          </button>
        )}

        {/* Expanded Panel */}
        {isExpanded && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[55]"
              onClick={() => setIsExpanded(false)}
            />
            
            {/* Panel Content */}
            <div className="fixed right-0 top-0 bottom-0 w-80 bg-card shadow-2xl z-[55] border-l overflow-y-auto">
              <AdminPanelContent 
                onClose={() => setIsExpanded(false)} 
                isMobile={false}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
};
