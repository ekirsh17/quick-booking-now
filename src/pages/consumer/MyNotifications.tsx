import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabaseConsumer } from "@/integrations/supabase/client";
import { useConsumerAccountAuth } from "@/hooks/useConsumerAccountAuth";
import { ConsumerLayout } from "@/components/consumer/ConsumerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bell, Trash2, Clock, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { isRequestActive } from "@/utils/notifyRequestActivity";
import { formatTimeRangeDisplay } from "@/utils/notifyTimeRangeDisplay";

interface NotificationRequest {
  id: string;
  merchant_id: string;
  time_range: string;
  staff_id: string | null;
  staff_name: string | null;
  created_at: string;
  business_name: string;
  merchant_time_zone: string;
}

const MyNotifications = () => {
  const { user } = useConsumerAccountAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<NotificationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    loadNotificationRequests();
  }, [user]);

  const loadNotificationRequests = async () => {
    try {
      // First get the consumer_id for this user
      const { data: consumerData, error: consumerError } = await supabaseConsumer
        .from("consumers")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (consumerError) throw consumerError;
      if (!consumerData) {
        setRequests([]);
        setLoading(false);
        return;
      }

      // Then get their notification requests
      const { data, error } = await supabaseConsumer
        .from("notify_requests")
        .select(`
          id,
          merchant_id,
          time_range,
          staff_id,
          created_at
        `)
        .eq("consumer_id", consumerData.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const merchantIds = Array.from(new Set((data || []).map((req) => req.merchant_id)));
      const staffMap = new Map<string, string>();
      const merchantMap = new Map<string, { business_name: string; time_zone: string }>();

      if (merchantIds.length > 0) {
        const { data: merchantRows, error: merchantError } = await supabaseConsumer.rpc(
          "get_public_merchants_basic",
          { p_merchant_ids: merchantIds },
        );
        if (merchantError) {
          console.warn("Failed to load public merchant metadata:", merchantError);
        } else {
          (merchantRows || []).forEach((merchant) => {
            merchantMap.set(merchant.merchant_id, {
              business_name: merchant.business_name || "Unknown Business",
              time_zone: merchant.time_zone || "America/New_York",
            });
          });
        }

        const staffResponses = await Promise.all(
          merchantIds.map(async (merchantId) => {
            const { data: staffData } = await supabaseConsumer.rpc('get_public_staff', {
              p_merchant_id: merchantId,
              p_location_id: null,
            });
            return { merchantId, staffData: staffData || [] };
          })
        );

        staffResponses.forEach(({ staffData }) => {
          staffData.forEach((staff) => {
            staffMap.set(staff.id, staff.name);
          });
        });
      }

      const formattedData = data?.map((req) => ({
        id: req.id,
        merchant_id: req.merchant_id,
        time_range: req.time_range,
        staff_id: req.staff_id || null,
        staff_name: req.staff_id ? staffMap.get(req.staff_id) || null : null,
        created_at: req.created_at,
        business_name: merchantMap.get(req.merchant_id)?.business_name || "Unknown Business",
        merchant_time_zone: merchantMap.get(req.merchant_id)?.time_zone || "America/New_York",
      })) || [];

      setRequests(formattedData);
    } catch (error) {
      console.error("Error loading notification requests:", error);
      toast.error("Failed to load your notification requests");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (requestId: string) => {
    try {
      const { error } = await supabaseConsumer
        .from("notify_requests")
        .delete()
        .eq("id", requestId);

      if (error) throw error;

      setRequests(requests.filter((r) => r.id !== requestId));
      toast.success("Notification request cancelled");
    } catch (error) {
      console.error("Error cancelling request:", error);
      toast.error("Failed to cancel request");
    }
  };

  const isRequestExpired = (request: NotificationRequest) => {
    if (request.time_range === "anytime") return false;
    return !isRequestActive(
      request.time_range,
      request.created_at,
      request.merchant_time_zone
    );
  };

  const activeRequests = requests.filter((r) => !isRequestExpired(r));
  const pastRequests = requests.filter((r) => isRequestExpired(r));

  const getStaffDisplay = (request: NotificationRequest) => {
    if (!request.staff_id) return "Any staff";
    return request.staff_name || "Staff";
  };

  if (loading) {
    return (
      <ConsumerLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </ConsumerLayout>
    );
  }

  if (!user) {
    return (
      <ConsumerLayout>
        <div className="max-w-2xl mx-auto py-12 px-4">
          <Card>
            <CardHeader className="text-center">
              <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <CardTitle>Sign in to view your waitlists</CardTitle>
              <CardDescription>
                See all the businesses you're waiting on and get first dibs when spots open up
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button onClick={() => navigate("/consumer/sign-in")}>Sign In</Button>
            </CardContent>
          </Card>
        </div>
      </ConsumerLayout>
    );
  }

  return (
    <ConsumerLayout>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Notifications</h1>
          <p className="text-muted-foreground">
            Get first dibs when appointments open up at your favorite spots
          </p>
        </div>

        {requests.length === 0 ? (
          <Card>
            <CardHeader className="text-center">
              <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <CardTitle>No waitlists yet</CardTitle>
              <CardDescription>
                When you join a business's waitlist, you'll be the first to know when someone cancels. Scan a QR code or visit a business's OpenAlert page to get started.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-8">
            {activeRequests.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-xl font-semibold">Active</h2>
                  <Badge variant="secondary">{activeRequests.length}</Badge>
                </div>
                <div className="space-y-3">
                  {activeRequests.map((request) => (
                    <Card key={request.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold mb-1">
                              {request.business_name}
                            </h3>
                            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {formatTimeRangeDisplay(request.time_range)}
                              </div>
                              <div className="flex items-center gap-1">
                                <Bell className="w-4 h-4" />
                                {getStaffDisplay(request)}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                Requested {format(parseISO(request.created_at), "MMM d")}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCancel(request.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {pastRequests.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-xl font-semibold">Past</h2>
                  <Badge variant="outline">{pastRequests.length}</Badge>
                </div>
                <div className="space-y-3">
                  {pastRequests.map((request) => (
                    <Card key={request.id} className="opacity-60">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold mb-1">
                              {request.business_name}
                            </h3>
                            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {formatTimeRangeDisplay(request.time_range)}
                              </div>
                              <div className="flex items-center gap-1">
                                <Bell className="w-4 h-4" />
                                {getStaffDisplay(request)}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {format(parseISO(request.created_at), "MMM d")}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCancel(request.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ConsumerLayout>
  );
};

export default MyNotifications;
