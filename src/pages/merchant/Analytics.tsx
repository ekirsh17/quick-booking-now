import { Card } from "@/components/ui/card";
import MerchantLayout from "@/components/merchant/MerchantLayout";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
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
          <h1 className="text-3xl font-bold mb-1">Reporting</h1>
          <p className="text-lg text-muted-foreground/80">
            Revenue recovered from last-minute cancellations
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
              <CalendarCheck className="w-5 h-5 text-primary" />
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
              <div className="text-sm text-muted-foreground">Revenue Recovered</div>
              <DollarSign className="w-5 h-5 text-primary" />
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
          <h2 className="text-lg font-semibold mb-1">Weekly Activity</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Openings created vs. slots filled
          </p>
          
          {loading ? (
            <div className="h-[250px] flex items-center justify-center">
              <Skeleton className="h-full w-full" />
            </div>
          ) : !hasData || metrics.weeklyData.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No openings filled yet.</p>
                <p className="text-xs mt-1">Create your first opening to get started.</p>
              </div>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={metrics.weeklyData} barGap={4}>
                  <XAxis 
                    dataKey="weekLabel" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    allowDecimals={false}
                    width={30}
                  />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '12px',
                      padding: '8px 12px'
                    }}
                    labelStyle={{ 
                      color: 'hsl(var(--foreground))',
                      fontWeight: 500,
                      marginBottom: '4px'
                    }}
                  />
                  <Bar 
                    dataKey="slotsCreated" 
                    name="Openings"
                    fill="hsl(var(--muted-foreground))" 
                    radius={[4, 4, 0, 0]} 
                    opacity={0.4}
                  />
                  <Bar 
                    dataKey="slotsFilled" 
                    name="Filled"
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
              {/* Inline legend */}
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-3 h-3 rounded-sm bg-muted-foreground/40" />
                  <span>Openings</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-3 h-3 rounded-sm bg-primary" />
                  <span>Filled</span>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </MerchantLayout>
  );
};

export default Analytics;
