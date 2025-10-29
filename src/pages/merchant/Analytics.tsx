import { Card } from "@/components/ui/card";
import MerchantLayout from "@/components/merchant/MerchantLayout";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const Analytics = () => {
  // Mock data
  const weeklyData = [
    { day: "Mon", notifications: 8, bookings: 6 },
    { day: "Tue", notifications: 12, bookings: 9 },
    { day: "Wed", notifications: 6, bookings: 4 },
    { day: "Thu", notifications: 10, bookings: 8 },
    { day: "Fri", notifications: 15, bookings: 12 },
    { day: "Sat", notifications: 18, bookings: 14 },
    { day: "Sun", notifications: 5, bookings: 3 },
  ];

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
          <h1 className="text-3xl font-bold mb-2">Analytics</h1>
          <p className="text-muted-foreground">
            Detailed insights into your notification performance
          </p>
        </div>

        {/* Weekly Performance Chart */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-6">Weekly Performance</h2>
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
          <h2 className="text-xl font-semibold mb-4">Most Popular Times</h2>
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

        {/* Key Metrics Grid */}
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
    </MerchantLayout>
  );
};

export default Analytics;
