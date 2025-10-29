import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronDown, ChevronUp, User, ShoppingBag, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const AdminToggle = () => {
  const { viewMode, setViewMode, isAdminMode } = useAdmin();
  const [isExpanded, setIsExpanded] = useState(false);
  const [merchantId, setMerchantId] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchTestData = async () => {
    // Get merchant ID (current user)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setMerchantId(user.id);
      console.log('[AdminToggle] merchantId:', user.id);
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
      console.log('[AdminToggle] availableSlots:', slots);
    }
  };

  useEffect(() => {
    if (isAdminMode && isExpanded) {
      fetchTestData();
    }
  }, [isAdminMode, isExpanded, viewMode]);

  // Real-time subscription for slot changes
  useEffect(() => {
    if (!isAdminMode) return;

    const channel = supabase
      .channel('admin-slots')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'slots',
          filter: 'status=eq.open'
        },
        (payload) => {
          console.log('[AdminToggle] New slot created:', payload.new);
          setAvailableSlots(prev => [...prev, payload.new as any]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'slots'
        },
        (payload) => {
          console.log('[AdminToggle] Slot updated:', payload.new);
          // Remove from list if no longer open
          if (payload.new.status !== 'open') {
            setAvailableSlots(prev => prev.filter(slot => slot.id !== payload.new.id));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'slots'
        },
        (payload) => {
          console.log('[AdminToggle] Slot deleted:', payload.old);
          setAvailableSlots(prev => prev.filter(slot => slot.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchTestData()}
                title="Refresh test data"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {isExpanded && (
            <div className="space-y-4">
              <div>
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
                    onClick={() => navigate('/merchant/add-availability')}
                  >
                    Add Opening
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => navigate('/merchant/dashboard')}
                  >
                    Recent Activity
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => navigate('/merchant/analytics')}
                  >
                    Reporting
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
                  <h4 className="text-sm font-medium mb-2">Consumer Flows:</h4>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      if (merchantId) {
                        navigate(`/notify/${merchantId}`);
                      } else {
                        toast({
                          title: "Setup Required",
                          description: "Please log in as a merchant first",
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    1. Request Notification
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      if (availableSlots.length > 0) {
                        navigate(`/claim/${availableSlots[0].id}`);
                      } else {
                        toast({
                          title: "No Available Slots",
                          description: "Create a slot in the merchant dashboard first",
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    2. Claim Slot
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      if (availableSlots.length > 0) {
                        navigate(`/booking-confirmed/${availableSlots[0].id}`);
                      } else {
                        toast({
                          title: "No Available Slots",
                          description: "Create a slot to test confirmation flow",
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    3. Booking Confirmation (Native)
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      toast({
                        title: "Setup Required",
                        description: "Set a booking_url in Settings to test third-party flow"
                      });
                    }}
                  >
                    4. Booking Confirmation (Third-Party)
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
