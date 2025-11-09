import { ReactNode, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import notifymeIcon from "@/assets/notifyme-icon.png";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { User, Bell, LogOut, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ConsumerLayoutProps {
  businessName?: string;
  children: ReactNode;
}

export const ConsumerLayout = ({ 
  businessName, 
  children 
}: ConsumerLayoutProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [consumerName, setConsumerName] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadConsumerName(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user) {
        setTimeout(() => loadConsumerName(session.user.id), 0);
      } else {
        setConsumerName("");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadConsumerName = async (userId: string) => {
    const { data } = await supabase
      .from('consumers')
      .select('name')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (data) {
      setConsumerName(data.name);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You've been signed out successfully.",
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Simple header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 flex items-center justify-center">
                <img src={notifymeIcon} alt="NotifyMe" className="w-full h-full object-contain rounded-lg" />
              </div>
          <h1 className="text-lg font-semibold">
            NotifyMe
          </h1>
            </Link>
          </div>

          {/* Auth UI */}
          {session && consumerName ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">{consumerName}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/my-notifications" className="cursor-pointer flex items-center">
                    <Bell className="mr-2 h-4 w-4" />
                    <span>My Notifications</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/consumer/settings" className="cursor-pointer flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/consumer/sign-in">
              <button className="text-sm hover:opacity-80 transition-opacity">
                Sign In
              </button>
            </Link>
          )}
        </div>
      </header>

      {/* Main content - centered, max-width constrained */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      {/* Simple footer */}
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        <p>Powered by NotifyMe</p>
      </footer>
    </div>
  );
};
