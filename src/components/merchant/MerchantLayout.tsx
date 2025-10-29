import { useState } from "react"; // TEMPORARY - Remove with admin panel
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/contexts/AdminContext"; // TEMPORARY - Remove before production
import { AdminToggle } from "@/components/admin/AdminToggle"; // TEMPORARY - Remove before production
import { AdminBadge } from "@/components/admin/AdminBadge"; // TEMPORARY - Remove before production
import { 
  CalendarClock, 
  PlusCircle, 
  BarChart3, 
  Settings, 
  LogOut,
  Scissors,
  Shield, // TEMPORARY - Remove with admin panel
  Users // TEMPORARY - Remove with admin panel
} from "lucide-react";

interface MerchantLayoutProps {
  children: React.ReactNode;
}

const MerchantLayout = ({ children }: MerchantLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isAdmin } = useAdmin(); // TEMPORARY - Remove before production
  const [adminMode, setAdminMode] = useState(false); // TEMPORARY - Remove before production

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // TEMPORARY - Remove admin navigation before production
  const merchantNavItems = [
    { to: "/merchant/add-availability", icon: PlusCircle, label: "Add Opening" },
    { to: "/merchant/dashboard", icon: CalendarClock, label: "Manage Openings" },
    { to: "/merchant/analytics", icon: BarChart3, label: "Reporting" },
    { to: "/merchant/settings", icon: Settings, label: "Settings" },
  ];

  const adminNavItems = [
    { to: "/admin", icon: Shield, label: "Admin Dashboard" },
    { to: "/merchant/dashboard", icon: CalendarClock, label: "My Dashboard" },
  ];

  const navItems = adminMode ? adminNavItems : merchantNavItems;

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - Desktop */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card hidden lg:block">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b px-6 gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Scissors className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Notify</h1>
            </div>
            {adminMode && <AdminBadge />} {/* TEMPORARY - Remove before production */}
          </div>
          
          {/* TEMPORARY - Remove AdminToggle before production */}
          {isAdmin && <AdminToggle enabled={adminMode} onToggle={setAdminMode} />}
          
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

          <div className="border-t p-4">
            <Button variant="ghost" className="w-full justify-start" onClick={handleSignOut}>
              <LogOut className="mr-2 h-5 w-5" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card lg:hidden">
        <nav className="flex justify-around p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <Link key={item.to} to={item.to} className="flex-1">
                <div
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <main className="lg:pl-64">
        <div className="container mx-auto p-6 pb-24 lg:pb-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MerchantLayout;
