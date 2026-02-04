import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useMerchantProfile } from "@/hooks/useMerchantProfile";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useBillingPortal, useStripeCheckout } from "@/hooks/useSubscription";
import { useActiveLocation } from "@/hooks/useActiveLocation";
import { format } from "date-fns";
import {
  Calendar,
  BarChart3,
  UserCircle,
  LogOut,
  Building2,
  Check,
  QrCode
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogoMark } from "@/components/brand/LogoMark";

interface MerchantLayoutProps {
  children?: React.ReactNode;
}

function PaymentRequiredBanner() {
  const entitlements = useEntitlements();
  const { openPortal } = useBillingPortal();
  const { createCheckout } = useStripeCheckout();

  if (entitlements.loading) {
    return null;
  }

  if (entitlements.subscriptionData.suppressBillingBanner) {
    return null;
  }

  const handleManageSubscription = async () => {
    if (entitlements.subscriptionData.subscription?.billing_provider !== 'stripe') {
      window.location.assign('/merchant/billing');
      return;
    }

    try {
      await openPortal({ returnUrl: window.location.href });
    } catch {
      window.location.assign('/merchant/billing');
    }
  };

  const handleReactivateSubscription = async () => {
    try {
      const successUrl = `${window.location.origin}/merchant/billing?billing=success`;
      const cancelUrl = `${window.location.origin}/merchant/billing?billing=canceled`;
      const planId = (entitlements.subscriptionData.subscription?.plan_id as 'starter' | 'pro' | null)
        || 'starter';
      await createCheckout(planId, undefined, { successUrl, cancelUrl });
    } catch {
      window.location.assign('/merchant/billing');
    }
  };

  if ((entitlements.trialNeedsResubscribe || entitlements.isCanceledTrial) && entitlements.trialEndsAt) {
    const trialEndLabel = format(new Date(entitlements.trialEndsAt), 'MMMM d, yyyy');
    return (
      <button
        type="button"
        onClick={handleReactivateSubscription}
        className="mb-4 flex w-full items-center justify-between rounded-lg bg-amber-50 px-4 py-2.5 text-left text-sm transition-colors hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30"
      >
        <span className="text-amber-800 dark:text-amber-200">
          Trial ends {trialEndLabel}. Resubscribe to keep bookings flowing.
        </span>
        <span className="text-xs font-medium text-amber-700 dark:text-amber-300 underline">
          Reactivate Subscription →
        </span>
      </button>
    );
  }

  if (entitlements.requiresPayment && entitlements.blockReason) {
    const isCanceled = entitlements.subscriptionData.isCanceled;
    const containerClasses = isCanceled
      ? 'bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30'
      : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30';
    const textClasses = isCanceled
      ? 'text-red-800 dark:text-red-200'
      : 'text-amber-800 dark:text-amber-200';
    const ctaClasses = isCanceled
      ? 'text-red-700 dark:text-red-300'
      : 'text-amber-700 dark:text-amber-300';
    const ctaLabel = isCanceled ? 'Reactivate Subscription →' : 'Manage Subscription →';
    const handleClick = isCanceled ? handleReactivateSubscription : handleManageSubscription;
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`mb-4 flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-left text-sm transition-colors ${containerClasses}`}
      >
        <span className={textClasses}>
          {entitlements.blockReason}
        </span>
        <span className={`text-xs font-medium underline ${ctaClasses}`}>
          {ctaLabel}
        </span>
      </button>
    );
  }

  if (entitlements.isTrialing && entitlements.trialNeedsPaymentMethod && entitlements.trialEndsAt) {
    const trialEndLabel = format(new Date(entitlements.trialEndsAt), 'MMMM d, yyyy');
    return (
      <button
        type="button"
        onClick={handleManageSubscription}
        className="mb-4 flex w-full items-center justify-between rounded-lg bg-amber-50 px-4 py-2.5 text-left text-sm transition-colors hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30"
      >
        <span className="text-amber-800 dark:text-amber-200">
          Your trial will expire on {trialEndLabel} unless billing info is updated.
        </span>
        <span className="text-xs font-medium text-amber-700 dark:text-amber-300 underline">
          Manage Subscription →
        </span>
      </button>
    );
  }

  return null;
}

const MerchantLayout = ({ children }: MerchantLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { profile } = useMerchantProfile();
  const { locationId, locations, setActiveLocationId } = useActiveLocation();
  const entitlements = useEntitlements();
  const activeLocation = locations.find((loc) => loc.id === locationId) || null;
  const showLocationSwitcher = locations.length > 1;
  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const navItems = [
    { to: "/merchant/openings", icon: Calendar, label: "Openings", requiresAccess: true },
    { to: "/merchant/analytics", icon: BarChart3, label: "Reporting" },
    { to: "/merchant/qr-code", icon: QrCode, label: "QR Code", requiresAccess: true },
    { to: "/merchant/settings", icon: UserCircle, label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Top App Bar */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-card/95 backdrop-blur border-b z-50 lg:hidden safe-top">
        <div className="flex items-center justify-between h-full px-4">
          <Link to="/merchant/openings" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <LogoMark className="w-7 h-7" />
            <h1 className="text-lg font-bold">OpenAlert</h1>
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
                        {activeLocation?.name && (
                          <p className="text-xs text-muted-foreground truncate">{activeLocation.name}</p>
                        )}
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                </>
              )}

              {showLocationSwitcher && (
                <>
                  <DropdownMenuLabel>Location</DropdownMenuLabel>
                  {locations.map((loc) => (
                    <DropdownMenuItem
                      key={loc.id}
                      onClick={() => setActiveLocationId(loc.id)}
                    >
                      {loc.id === locationId && <Check className="mr-2 h-4 w-4" strokeWidth={1.5} />}
                      <span className={cn(loc.id === locationId ? "font-medium" : "")}>
                        {loc.name || 'Untitled location'}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
              
              <DropdownMenuItem onClick={() => navigate("/merchant/settings")}>
                <UserCircle className="mr-2 h-4 w-4" strokeWidth={1.5} />
                Settings
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
                <LogoMark className="w-full h-full" />
              </div>
              <h1 className="text-xl font-bold">OpenAlert</h1>
            </Link>
          </div>

          {showLocationSwitcher && (
            <div className="px-4 pt-4">
              <div className="text-xs text-muted-foreground mb-1">Location</div>
              <Select
                value={locationId ?? locations[0]?.id ?? undefined}
                onValueChange={setActiveLocationId}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name || 'Untitled location'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <nav className="flex-1 space-y-1 p-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
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
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{profile.business_name}</div>
                  {activeLocation?.name && (
                    <div className="text-xs text-muted-foreground truncate">{activeLocation.name}</div>
                  )}
                </div>
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
            const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
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
          <PaymentRequiredBanner />
          {children ?? <Outlet />}
        </div>
      </main>
    </div>
  );
};

export default MerchantLayout;
