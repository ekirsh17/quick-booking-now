import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useMerchantProfile } from "@/hooks/useMerchantProfile";
import { useEntitlements } from "@/hooks/useEntitlements";
import {
  Calendar,
  BarChart3,
  UserCircle,
  LogOut,
  Building2,
  QrCode,
  Zap,
  AlertTriangle,
  X,
  Sparkles
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import notifymeIcon from "@/assets/notifyme-icon.png";

interface MerchantLayoutProps {
  children: React.ReactNode;
}

// Helper to get/set dismissal state in localStorage
function getTrialDismissalState(): { milestone: string; dismissedAt: number } | null {
  try {
    const stored = localStorage.getItem('trial-banner-dismissed');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function setTrialDismissalState(milestone: string) {
  localStorage.setItem('trial-banner-dismissed', JSON.stringify({
    milestone,
    dismissedAt: Date.now()
  }));
}

function clearTrialDismissalState() {
  localStorage.removeItem('trial-banner-dismissed');
}

// Subscription Banner Component
function SubscriptionStatusBanner() {
  const entitlements = useEntitlements();
  const location = useLocation();
  const navigate = useNavigate();
  const [isDismissed, setIsDismissed] = React.useState(false);
  
  const daysLeft = entitlements.trialDaysRemaining ?? 0;
  const openingsFilled = entitlements.trialOpeningsFilled ?? 0;
  const openingsMax = entitlements.trialOpeningsMax ?? 2;
  
  // Calculate current milestone for dismissal tracking
  const getCurrentMilestone = () => {
    if (daysLeft <= 7) return 'days-warning';
    if (openingsFilled >= openingsMax - 1) return 'openings-warning';
    return 'normal';
  };
  
  const currentMilestone = getCurrentMilestone();
  
  // Check if banner should show based on dismissal state
  React.useEffect(() => {
    const dismissalState = getTrialDismissalState();
    if (dismissalState) {
      // If milestone has changed, clear dismissal and show banner
      if (dismissalState.milestone !== currentMilestone) {
        clearTrialDismissalState();
        setIsDismissed(false);
      } else {
        setIsDismissed(true);
      }
    }
  }, [currentMilestone]);
  
  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTrialDismissalState(currentMilestone);
    setIsDismissed(true);
  };
  
  // Don't show on billing page
  if (location.pathname === '/merchant/billing') {
    return null;
  }
  
  // Loading state - don't show anything
  if (entitlements.loading) {
    return null;
  }
  
  // Payment required - always show, cannot dismiss
  if (entitlements.requiresPayment && entitlements.blockReason) {
    return (
      <Link
        to="/merchant/billing"
        className="mb-4 flex items-center justify-between rounded-lg bg-amber-50 px-4 py-2.5 text-sm transition-colors hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-amber-800 dark:text-amber-200">
            {entitlements.blockReason}
          </span>
        </div>
        <span className="text-xs font-medium text-amber-700 dark:text-amber-300 underline">
          Manage Billing →
        </span>
      </Link>
    );
  }
  
  // Trial indicator - dismissible
  if (entitlements.isTrialing && !entitlements.requiresPayment && !isDismissed) {
    const isUrgent = daysLeft <= 7 || openingsFilled >= openingsMax - 1;
    
    return (
      <div
        className={cn(
          "mb-4 flex items-center justify-between rounded-lg px-4 py-2.5 text-sm transition-colors",
          isUrgent 
            ? "bg-amber-50 dark:bg-amber-900/20" 
            : "bg-emerald-50 dark:bg-emerald-900/20"
        )}
      >
        <button
          onClick={() => navigate('/merchant/billing')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Zap className={cn(
            "h-4 w-4",
            isUrgent 
              ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-600 dark:text-emerald-400"
          )} />
          <span className={cn(
            "font-medium",
            isUrgent
              ? "text-amber-800 dark:text-amber-200"
              : "text-emerald-800 dark:text-emerald-200"
          )}>
            Trial: {openingsFilled}/{openingsMax} openings filled
          </span>
          {isUrgent && (
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full",
              daysLeft <= 7 
                ? "bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200"
                : "bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200"
            )}>
              {daysLeft <= 7 ? `${daysLeft} days left` : 'Almost there!'}
            </span>
          )}
        </button>
        <button
          onClick={handleDismiss}
          className={cn(
            "p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors",
            isUrgent
              ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-600 dark:text-emerald-400"
          )}
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }
  
  return null;
}

const MerchantLayout = ({ children }: MerchantLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { profile } = useMerchantProfile();
  const entitlements = useEntitlements();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };
  
  // Trial info for header badge
  const showTrialBadge = entitlements.isTrialing && !entitlements.requiresPayment;
  const trialOpeningsFilled = entitlements.trialOpeningsFilled ?? 0;
  const trialOpeningsMax = entitlements.trialOpeningsMax ?? 2;

  const navItems = [
    { to: "/merchant/openings", icon: Calendar, label: "Openings" },
    { to: "/merchant/analytics", icon: BarChart3, label: "Reporting" },
    { to: "/merchant/qr-code", icon: QrCode, label: "QR Code" },
    { to: "/merchant/settings", icon: UserCircle, label: "Account" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Top App Bar */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-card/95 backdrop-blur border-b z-50 lg:hidden safe-top">
        <div className="flex items-center justify-between h-full px-4">
          <Link to="/merchant/openings" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src={notifymeIcon} alt="NotifyMe" className="w-7 h-7 object-contain rounded-lg" />
            <h1 className="text-lg font-bold">NotifyMe</h1>
          </Link>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="touch-feedback"
              >
                {profile ? (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" strokeWidth={1.5} />
                    <span className="text-xs font-medium max-w-[80px] truncate">{profile.business_name}</span>
                  </div>
                ) : (
                  <Building2 className="h-5 w-5" strokeWidth={1.5} />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover">
              {profile && (
                <>
                  <DropdownMenuLabel>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" strokeWidth={1.5} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{profile.business_name}</p>
                        {profile.phone && (
                          <p className="text-xs text-muted-foreground">{profile.phone}</p>
                        )}
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                </>
              )}
              
              {showTrialBadge && (
                <DropdownMenuItem onClick={() => navigate("/merchant/billing")}>
                  <Sparkles className="mr-2 h-4 w-4 text-emerald-600" strokeWidth={1.5} />
                  <span className="text-emerald-700 dark:text-emerald-400">
                    Trial: {trialOpeningsFilled}/{trialOpeningsMax} openings
                  </span>
                </DropdownMenuItem>
              )}
              
              <DropdownMenuItem onClick={() => navigate("/merchant/settings")}>
                <UserCircle className="mr-2 h-4 w-4" strokeWidth={1.5} />
                Account
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem 
                onClick={handleSignOut}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <LogOut className="mr-2 h-4 w-4" strokeWidth={1.5} />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>


      {/* Sidebar - Desktop */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-56 border-r bg-card hidden lg:block">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b px-6 gap-3">
            <Link to="/merchant/openings" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 flex items-center justify-center">
                <img src={notifymeIcon} alt="NotifyMe" className="w-full h-full object-contain rounded-lg" />
              </div>
              <h1 className="text-xl font-bold">NotifyMe</h1>
            </Link>
          </div>
          
          <nav className="flex-1 space-y-1 p-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <Link key={item.to} to={item.to}>
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.5} />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="border-t p-4 space-y-3">
            {profile && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
                <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" strokeWidth={1.5} />
                <span className="text-sm font-medium truncate">{profile.business_name}</span>
              </div>
            )}
            <Button variant="ghost" className="w-full justify-start" onClick={handleSignOut}>
              <LogOut className="mr-2 h-5 w-5" strokeWidth={1.5} />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-[60] border-t bg-card/95 backdrop-blur-sm lg:hidden">
        <nav className="flex justify-around min-h-[64px] pb-safe">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <Link key={item.to} to={item.to} className="flex-1">
                <div
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 px-2 py-2 text-xs font-medium transition-all touch-feedback h-full",
                    isActive
                      ? "text-primary scale-105"
                      : "text-muted-foreground active:scale-95"
                  )}
                >
                  <Icon className="h-6 w-6" strokeWidth={1.5} />
                  <span className="text-[10px] leading-tight text-center">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <main className="lg:pl-56">
        <div className="container mx-auto px-4 pt-16 pb-28 lg:px-6 lg:pt-6 lg:pb-6">
          <SubscriptionStatusBanner />
          {children}
        </div>
      </main>
    </div>
  );
};

export default MerchantLayout;
