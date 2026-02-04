import { ReactNode, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { LogoMark } from "@/components/brand/LogoMark";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
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
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30 flex flex-col">
      {/* Polished header with backdrop blur */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 flex items-center justify-center">
                <LogoMark className="w-full h-full" />
              </div>
              <span className="text-lg font-semibold">OpenAlert</span>
            </Link>
          </div>

          {/* Auth UI */}
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity">
                <User className="h-4 w-4" strokeWidth={1.5} />
                <span className="hidden sm:inline">{consumerName || "Account"}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/my-notifications" className="cursor-pointer flex items-center">
                    <Bell className="mr-2 h-4 w-4" strokeWidth={1.5} />
                    <span>My Notifications</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/consumer/settings" className="cursor-pointer flex items-center">
                    <Settings className="mr-2 h-4 w-4" strokeWidth={1.5} />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" strokeWidth={1.5} />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link to="/consumer/sign-in">Sign In</Link>
            </Button>
          )}
        </div>
      </header>

      {/* Main content - centered with better vertical spacing */}
      <main className="flex-1 flex items-center justify-center p-4 min-h-[60vh]">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      {/* Simple footer */}
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        <p>Powered by OpenAlert</p>
      </footer>
    </div>
  );
};
