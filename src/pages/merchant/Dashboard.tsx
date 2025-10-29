import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Bell, Calendar, DollarSign, TrendingUp } from "lucide-react";
import MerchantLayout from "@/components/merchant/MerchantLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const MerchantDashboard = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState({
    notificationsSent: 0,
    appointmentsBooked: 0,
    estimatedRevenue: 0,
    avgAppointmentValue: 70,
  });
  const [recentSlots, setRecentSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;

      try {
        // Fetch profile for avg appointment value
        const { data: profile } = await supabase
          .from('profiles')
          .select('avg_appointment_value')
          .eq('id', user.id)
          .single();

        // Fetch slots
        const { data: slots } = await supabase
          .from('slots')
          .select('*')
          .eq('merchant_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        // Fetch notifications count
        const { count: notificationCount } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('merchant_id', user.id);

        const bookedSlots = slots?.filter(s => s.status === 'booked').length || 0;
        const avgValue = profile?.avg_appointment_value || 70;

        setMetrics({
          notificationsSent: notificationCount || 0,
          appointmentsBooked: bookedSlots,
          estimatedRevenue: bookedSlots * avgValue,
          avgAppointmentValue: avgValue,
        });

        // Format slots for display
        const formattedSlots = slots?.map(slot => {
          const startTime = new Date(slot.start_time);
          const endTime = new Date(slot.end_time);
          const timeStr = `${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
          
          return {
            id: slot.id,
            time: timeStr,
            status: slot.status === 'booked' ? 'Booked' : 'Open',
            customer: slot.booked_by_name,
          };
        }) || [];

        setRecentSlots(formattedSlots);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  return (
    <MerchantLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back! Here's your overview.</p>
          </div>
          <Button asChild size="lg">
            <Link to="/merchant/add-availability">+ Add Opening</Link>
          </Button>
        </div>

        {/* Recent Activity */}
        <Card>
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Recent Activity</h2>
          </div>
          <div className="divide-y">
            {loading ? (
              <div className="p-6 text-center text-muted-foreground">
                Loading...
              </div>
            ) : recentSlots.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                No slots yet. Add your first opening to get started!
              </div>
            ) : (
              recentSlots.map((slot) => (
                <div key={slot.id} className="p-6 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{slot.time}</div>
                    <div className="text-sm text-muted-foreground">
                      {slot.status === "Booked" && slot.customer
                        ? `Booked by ${slot.customer}`
                        : slot.status
                      }
                    </div>
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                        slot.status === "Booked"
                          ? "bg-success/10 text-success"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {slot.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-6 border-t">
            <Button asChild variant="outline" className="w-full">
              <Link to="/merchant/analytics">View All Analytics</Link>
            </Button>
          </div>
        </Card>
      </div>
    </MerchantLayout>
  );
};

export default MerchantDashboard;
