/**
 * TEMPORARY DEVELOPMENT COMPONENT - REMOVE BEFORE PRODUCTION
 * 
 * Floating admin panel for quick navigation between flows during development
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/hooks/useAuth';
import { FEATURES } from '@/config/features';
import { 
  Shield, 
  User, 
  Store, 
  Bell,
  Calendar,
  PlusCircle,
  BarChart3,
  Settings,
  CheckCircle
} from 'lucide-react';

export function AdminDevPanel() {
  const { isAdmin } = useAdmin();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Only show if admin panel feature is enabled and user is admin
  if (!FEATURES.ADMIN_PANEL || !isAdmin) {
    return null;
  }

  const handleNavigate = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg"
          variant="default"
        >
          <Shield className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      
      <SheetContent side="right" className="w-80 sm:w-96">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Dev Testing Panel</SheetTitle>
            <Badge variant="destructive" className="gap-1">
              <Shield className="h-3 w-3" />
              ADMIN
            </Badge>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Consumer Flows */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Consumer Flows</h3>
            </div>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleNavigate(`/notify/${user?.id || 'test'}`)}
              >
                <Bell className="mr-2 h-4 w-4" />
                View Notify Form
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleNavigate('/claim/test-slot-id')}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Test Claim Flow
              </Button>
            </div>
          </div>

          <Separator />

          {/* Merchant Flows */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Store className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Merchant Flows</h3>
            </div>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleNavigate('/merchant/dashboard')}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleNavigate('/merchant/add-availability')}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Availability
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleNavigate('/merchant/analytics')}
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Analytics
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleNavigate('/merchant/settings')}
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </div>
          </div>

          <Separator />

          {/* Info */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Use this panel to quickly navigate between different user flows for testing.</p>
            <p className="font-medium">User ID: {user?.id?.slice(0, 8)}...</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
