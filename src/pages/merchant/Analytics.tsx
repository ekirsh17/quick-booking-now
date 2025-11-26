import { Card } from "@/components/ui/card";
import MerchantLayout from "@/components/merchant/MerchantLayout";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Bell, Calendar, DollarSign, CalendarCheck } from "lucide-react";
import { useReportingMetrics } from "@/hooks/useReportingMetrics";
import { Skeleton } from "@/components/ui/skeleton";

const Analytics = () => {
  const { metrics, loading, error } = useReportingMetrics();

  // Empty state check
  const hasData = metrics.slotsFilled > 0 || metrics.notificationsSent > 0;

  return (
    <MerchantLayout>
      <div className="space-y-8">
        {/* Header with value-prop subtitle */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Reporting</h1>
          <p className="text-muted-foreground">
            Slots you might have lost, now filled.
          </p>
        </div>

        {/* Error state */}
        {error && (
          <Card className="p-6 border-destructive/50 bg-destructive/5">
            <p className="text-destructive text-sm">
              Unable to load metrics. Please try refreshing the page.
            </p>
          </Card>
        )}

        {/* Key Metrics - 3 hero KPIs */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">Slots Filled</div>
              <CalendarCheck className="w-5 h-5 text-success" />
            </div>
            {loading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <div className="text-3xl font-bold">{metrics.slotsFilled}</div>
            )}
            <div className="text-xs text-muted-foreground mt-1">Last 30 days</div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">Estimated Revenue</div>
              <DollarSign className="w-5 h-5 text-accent" />
            </div>
            {loading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <div className="text-3xl font-bold">${metrics.estimatedRevenue.toLocaleString()}</div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              Based on ~${metrics.avgAppointmentValue} avg
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">Notifications Sent</div>
              <Bell className="w-5 h-5 text-primary" />
            </div>
            {loading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <div className="text-3xl font-bold">{metrics.notificationsSent}</div>
            )}
            <div className="text-xs text-muted-foreground mt-1">SMS to customers</div>
          </Card>
        </div>

        {/* Weekly Performance Chart */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Weekly Activity</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Openings created vs. slots filled over the last 4 weeks
          </p>
          
          {loading ? (
            <div className="h-[300px] flex items-center justify-center">
              <Skeleton className="h-full w-full" />
            </div>
          ) : !hasData || metrics.weeklyData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No openings filled yet.</p>
                <p className="text-sm">Create your first opening to get started.</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metrics.weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="weekLabel" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                />
                <Bar 
                  dataKey="slotsCreated" 
                  name="Openings Created"
                  fill="hsl(var(--muted-foreground))" 
                  radius={[4, 4, 0, 0]} 
                  opacity={0.6}
                />
                <Bar 
                  dataKey="slotsFilled" 
                  name="Slots Filled"
                  fill="hsl(var(--success))" 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Value reminder */}
        {hasData && (
          <Card className="p-6 bg-primary/5 border-primary/20">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <CalendarCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">NotifyMe is working for you</h3>
                <p className="text-sm text-muted-foreground">
                  These {metrics.slotsFilled} filled slots represent appointments that might have stayed empty. 
                  Keep creating openings when cancellations happen — text us or use the Openings page.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </MerchantLayout>
  );
};

export default Analytics;
