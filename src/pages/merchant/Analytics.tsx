import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge"; // TEMPORARY - For mock data indicators
import MerchantLayout from "@/components/merchant/MerchantLayout";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Bell, Calendar, DollarSign, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FEATURES } from "@/config/features"; // TEMPORARY - Remove before production

const Analytics = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState({
    notificationsSent: 0,
    appointmentsBooked: 0,
    estimatedRevenue: 0,
    avgAppointmentValue: 70,
  });

  useEffect(() => {
    const fetchMetrics = async () => {
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
          .eq('merchant_id', user.id);

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
      } catch (error) {
        console.error('Error fetching metrics:', error);
      }
    };

    fetchMetrics();
  }, [user]);

  // SAMPLE DATA - Replace with real data from your backend
  const weeklyData = [
    { day: "Mon", notifications: 8, bookings: 6 },
    { day: "Tue", notifications: 12, bookings: 9 },
    { day: "Wed", notifications: 6, bookings: 4 },
    { day: "Thu", notifications: 10, bookings: 8 },
    { day: "Fri", notifications: 15, bookings: 12 },
    { day: "Sat", notifications: 18, bookings: 14 },
    { day: "Sun", notifications: 5, bookings: 3 },
  ];

  // SAMPLE DATA - Replace with real data from your backend
  const topTimes = [
    { time: "2:00 PM - 3:00 PM", bookings: 15 },
    { time: "11:00 AM - 12:00 PM", bookings: 12 },
    { time: "4:00 PM - 5:00 PM", bookings: 10 },
    { time: "10:00 AM - 11:00 AM", bookings: 8 },
  ];

  return (
    <MerchantLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Reporting</h1>
          <p className="text-muted-foreground">
            Performance metrics and booking insights
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">Notifications Sent</div>
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div className="text-3xl font-bold">{metrics.notificationsSent}</div>
            <div className="text-xs text-muted-foreground mt-1">This month</div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">Appointments Booked</div>
              <Calendar className="w-5 h-5 text-success" />
            </div>
            <div className="text-3xl font-bold">{metrics.appointmentsBooked}</div>
            <div className="text-xs text-success mt-1">+3 this week</div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">Estimated Revenue</div>
              <DollarSign className="w-5 h-5 text-accent" />
            </div>
            <div className="text-3xl font-bold">${metrics.estimatedRevenue}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {metrics.appointmentsBooked} × ${metrics.avgAppointmentValue} avg
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">Fill Rate</div>
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <div className="text-3xl font-bold">94%</div>
            <div className="text-xs text-success mt-1">Above average</div>
          </Card>
        </div>

        {/* Weekly Performance Chart */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Weekly Performance</h2>
            {FEATURES.MOCK_DATA && (
              <Badge variant="outline" className="text-xs">Sample Data</Badge>
            )}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="day" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="notifications" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              <Bar dataKey="bookings" fill="hsl(var(--success))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-muted-foreground">Notifications Sent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-success" />
              <span className="text-muted-foreground">Appointments Booked</span>
            </div>
          </div>
        </Card>

        {/* Top Performing Times */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Most Popular Times</h2>
            {FEATURES.MOCK_DATA && (
              <Badge variant="outline" className="text-xs">Sample Data</Badge>
            )}
          </div>
          <div className="space-y-4">
            {topTimes.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <span className="font-medium">{item.time}</span>
                </div>
                <span className="text-muted-foreground">{item.bookings} bookings</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Additional Metrics Grid - Sample Data */}
        {FEATURES.MOCK_DATA && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Sample Data</Badge>
              <span className="text-xs text-muted-foreground">The metrics below are examples</span>
            </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6">
              <div className="text-sm text-muted-foreground mb-2">Avg Response Time</div>
              <div className="text-3xl font-bold">47s</div>
              <div className="text-xs text-success mt-1">22% faster than average</div>
            </Card>

            <Card className="p-6">
              <div className="text-sm text-muted-foreground mb-2">Conversion Rate</div>
              <div className="text-3xl font-bold">68%</div>
              <div className="text-xs text-muted-foreground mt-1">Notifications → Bookings</div>
            </Card>

            <Card className="p-6">
              <div className="text-sm text-muted-foreground mb-2">Customer Satisfaction</div>
              <div className="text-3xl font-bold">4.8/5</div>
              <div className="text-xs text-success mt-1">Based on 23 reviews</div>
            </Card>
          </div>
          </div>
        )}
      </div>
    </MerchantLayout>
  );
};

export default Analytics;
