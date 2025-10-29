import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronUp, User, ShoppingBag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const AdminToggle = () => {
  const { viewMode, setViewMode, isAdminMode, toggleAdminMode } = useAdmin();
  const [isExpanded, setIsExpanded] = useState(false);
  const [merchantId, setMerchantId] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTestData = async () => {
      // Get merchant ID (current user)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setMerchantId(user.id);
      }

      // Get available slots for testing
      const { data: slots } = await supabase
        .from('slots')
        .select('id, start_time, status')
        .eq('status', 'open')
        .order('start_time', { ascending: true })
        .limit(5);
      
      if (slots) {
        setAvailableSlots(slots);
      }
    };

    if (isAdminMode) {
      fetchTestData();
    }
  }, [isAdminMode]);

  if (!isAdminMode) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="w-80 shadow-lg">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="font-semibold text-sm">Admin Mode</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>

          {isExpanded && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="admin-mode">Enable Admin Panel</Label>
                <Switch
                  id="admin-mode"
                  checked={isAdminMode}
                  onCheckedChange={toggleAdminMode}
                />
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium">View Mode:</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={viewMode === 'merchant' ? 'default' : 'outline'}
                      onClick={() => setViewMode('merchant')}
                      className="gap-1"
                    >
                      <ShoppingBag className="h-3 w-3" />
                      Merchant
                    </Button>
                    <Button
                      size="sm"
                      variant={viewMode === 'consumer' ? 'default' : 'outline'}
                      onClick={() => setViewMode('consumer')}
                      className="gap-1"
                    >
                      <User className="h-3 w-3" />
                      Consumer
                    </Button>
                  </div>
                </div>
              </div>

              {viewMode === 'merchant' && (
                <div className="border-t pt-4 space-y-2">
                  <h4 className="text-sm font-medium mb-2">Merchant Views:</h4>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => navigate('/merchant/dashboard')}
                  >
                    Dashboard
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => navigate('/merchant/add-availability')}
                  >
                    Add Availability
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => navigate('/merchant/settings')}
                  >
                    Settings
                  </Button>
                </div>
              )}

              {viewMode === 'consumer' && (
                <div className="border-t pt-4 space-y-2">
                  <h4 className="text-sm font-medium mb-2">Consumer Flow:</h4>
                  
                  {merchantId && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full justify-start text-xs"
                      onClick={() => navigate(`/notify/${merchantId}`)}
                    >
                      1. Request Notification
                    </Button>
                  )}

                  {availableSlots.length > 0 ? (
                    availableSlots.map((slot) => (
                      <Button
                        key={slot.id}
                        size="sm"
                        variant="outline"
                        className="w-full justify-start text-xs"
                        onClick={() => navigate(`/claim/${slot.id}`)}
                      >
                        2. Claim Slot ({new Date(slot.start_time).toLocaleTimeString()})
                      </Button>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground px-2">
                      No open slots. Create one first!
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
