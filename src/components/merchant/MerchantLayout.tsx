import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { useMerchantProfile } from "@/hooks/useMerchantProfile";
import {
  CalendarClock, 
  PlusCircle, 
  BarChart3, 
  Settings, 
  LogOut,
  Building2,
  Menu
} from "lucide-react";
import notifymeIcon from "@/assets/notifyme-icon.png";

interface MerchantLayoutProps {
  children: React.ReactNode;
}

const MerchantLayout = ({ children }: MerchantLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { profile } = useMerchantProfile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const navItems = [
    { to: "/merchant/add-availability", icon: PlusCircle, label: "Add Opening" },
    { to: "/merchant/dashboard", icon: CalendarClock, label: "Manage Openings" },
    { to: "/merchant/analytics", icon: BarChart3, label: "Reporting" },
    { to: "/merchant/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Top Bar */}
      <header className="block lg:hidden fixed top-0 left-0 right-0 z-50 h-14 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex items-center justify-between h-full px-4">
          <Link to="/merchant/add-availability" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src={notifymeIcon} alt="NotifyMe" className="w-7 h-7 rounded-lg" />
            <span className="font-semibold text-lg">NotifyMe</span>
          </Link>
          
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Account</SheetTitle>
              </SheetHeader>
              
              <div className="mt-6 space-y-4">
                {profile && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                    <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{profile.business_name}</p>
                      {profile.phone && (
                        <p className="text-xs text-muted-foreground mt-1">{profile.phone}</p>
                      )}
                    </div>
                  </div>
                )}
                
                <Link 
                  to="/merchant/settings" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  <Settings className="h-5 w-5" />
                  <span className="font-medium">Settings</span>
                </Link>
                
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" 
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 h-5 w-5" />
                  Sign Out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Sidebar - Desktop */}
      <aside className="hidden lg:block max-lg:hidden fixed left-0 top-0 z-40 h-screen w-64 max-lg:w-0 border-r bg-card">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b px-6 gap-3">
            <Link to="/merchant/add-availability" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
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
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="border-t p-4 space-y-3">
            {profile && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
                <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium truncate">{profile.business_name}</span>
              </div>
            )}
            <Button variant="ghost" className="w-full justify-start" onClick={handleSignOut}>
              <LogOut className="mr-2 h-5 w-5" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation */}
      <div className="block lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 safe-bottom">
        <nav className="flex justify-around p-2 min-h-[60px]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <Link key={item.to} to={item.to} className="flex-1">
                <div
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-all active:scale-95",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground active:text-foreground"
                  )}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-[11px] leading-tight">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <main className="lg:pl-64">
        <div className="container mx-auto px-4 pt-16 pb-20 lg:px-6 lg:pt-6 lg:pb-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MerchantLayout;
