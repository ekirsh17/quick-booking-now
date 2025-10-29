import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Bell, Calendar, DollarSign, TrendingUp } from "lucide-react";
import MerchantLayout from "@/components/merchant/MerchantLayout";

const MerchantDashboard = () => {
  // Mock data
  const metrics = {
    notificationsSent: 47,
    appointmentsBooked: 12,
    estimatedRevenue: 840,
    avgAppointmentValue: 70,
  };

  const recentSlots = [
    { id: 1, time: "2:00 PM - 2:25 PM", status: "Booked", customer: "John D." },
    { id: 2, time: "3:30 PM - 4:00 PM", status: "Notified", recipients: 8 },
    { id: 3, time: "11:00 AM - 11:30 AM", status: "Booked", customer: "Sarah M." },
  ];

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

        {/* Metrics */}
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

        {/* Recent Activity */}
        <Card>
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Recent Activity</h2>
          </div>
          <div className="divide-y">
            {recentSlots.map((slot) => (
              <div key={slot.id} className="p-6 flex items-center justify-between">
                <div>
                  <div className="font-medium">{slot.time}</div>
                  <div className="text-sm text-muted-foreground">
                    {slot.status === "Booked" 
                      ? `Booked by ${slot.customer}`
                      : `Notified ${slot.recipients} customers`
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
            ))}
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
