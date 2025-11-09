import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useMerchantProfile } from "@/hooks/useMerchantProfile";
import {
  CalendarDaysIcon,
  CalendarIcon,
  ChartBarIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  BuildingOffice2Icon,
  QrCodeIcon
} from "@heroicons/react/24/outline";
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

const MerchantLayout = ({ children }: MerchantLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { profile } = useMerchantProfile();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const navItems = [
    { to: "/merchant/openings", icon: CalendarIcon, label: "Openings" },
    { to: "/merchant/dashboard", icon: CalendarDaysIcon, label: "Dashboard" },
    { to: "/merchant/analytics", icon: ChartBarIcon, label: "Reporting" },
    { to: "/merchant/qr-code", icon: QrCodeIcon, label: "QR Code" },
    { to: "/merchant/settings", icon: UserCircleIcon, label: "Account" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Top App Bar */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-card/95 backdrop-blur border-b z-50 lg:hidden safe-top">
        <div className="flex items-center justify-between h-full px-4">
          <Link to="/merchant/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
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
                    <BuildingOffice2Icon className="h-4 w-4" />
                    <span className="text-xs font-medium max-w-[80px] truncate">{profile.business_name}</span>
                  </div>
                ) : (
                  <BuildingOffice2Icon className="h-5 w-5" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover">
              {profile && (
                <>
                  <DropdownMenuLabel>
                    <div className="flex items-center gap-2">
                      <BuildingOffice2Icon className="h-4 w-4" />
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
              
              <DropdownMenuItem onClick={() => navigate("/merchant/settings")}>
                <UserCircleIcon className="mr-2 h-4 w-4" />
                Account
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem 
                onClick={handleSignOut}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <ArrowRightOnRectangleIcon className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>


      {/* Sidebar - Desktop */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card hidden lg:block">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b px-6 gap-3">
            <Link to="/merchant/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
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
                <BuildingOffice2Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium truncate">{profile.business_name}</span>
              </div>
            )}
            <Button variant="ghost" className="w-full justify-start" onClick={handleSignOut}>
              <ArrowRightOnRectangleIcon className="mr-2 h-5 w-5" />
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
                  <Icon className="h-6 w-6" />
                  <span className="text-[10px] leading-tight text-center">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <main className="lg:pl-64">
        <div className="container mx-auto px-4 pt-16 pb-28 lg:px-6 lg:pt-6 lg:pb-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MerchantLayout;
