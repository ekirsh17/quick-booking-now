import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart3, Bell, DollarSign, CalendarCheck } from "lucide-react";
import { useReportingMetrics } from "@/hooks/useReportingMetrics";
import { useActiveLocation } from "@/hooks/useActiveLocation";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type DateRange = 7 | 30 | 90;

const Analytics = () => {
  const [days, setDays] = useState<DateRange>(30);
  const { locationId } = useActiveLocation();
  const { metrics, loading, error } = useReportingMetrics({ days, locationId });

  // Empty state check
  const hasData = metrics.slotsFilled > 0 || metrics.notificationsSent > 0;

  const dateRangeLabel = days === 7 ? 'Last 7 days' : days === 30 ? 'Last 30 days' : 'Last 90 days';

  return (
    <div className="space-y-8">
        <div className="space-y-8" data-tour-target="reporting-overview">
        {/* Header with date range selector */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-1">Reporting</h1>
            <p className="text-lg text-muted-foreground/80">
              Revenue recovered from last-minute cancellations
            </p>
          </div>
          
          {/* Date range buttons */}
          <div className="flex w-fit self-start sm:self-end gap-1 rounded-lg bg-muted/50 p-1">
            {([7, 30, 90] as DateRange[]).map((d) => (
              <Button
                key={d}
                variant="ghost"
                size="sm"
                onClick={() => setDays(d)}
                className={cn(
                  "px-3 py-1.5 h-auto text-xs font-medium transition-colors",
                  days === d 
                    ? "bg-background shadow-sm text-foreground" 
                    : "text-muted-foreground hover:text-foreground hover:bg-transparent"
                )}
              >
                {d}d
              </Button>
            ))}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <Card className="p-6 border-destructive/50 bg-destructive/5">
            <p className="text-destructive text-sm">
              Unable to load metrics. Please try refreshing the page.
            </p>
          </Card>
        )}

        {loading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((key) => (
              <Card key={key} className="p-6">
                <Skeleton className="h-9 w-24 mb-2" />
                <Skeleton className="h-9 w-20" />
              </Card>
            ))}
          </div>
        ) : !hasData ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">No reports yet</h3>
              <p className="mx-auto max-w-[15rem] text-pretty text-sm text-muted-foreground sm:max-w-xs">
                View data on openings, recovered revenue,
                <br />
                and notifications sent
              </p>
            </div>
          </div>
        ) : (
          <>
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">Openings Booked</div>
              <CalendarCheck className="w-5 h-5 text-primary" />
            </div>
            <div className="text-3xl font-bold">{metrics.slotsFilled}</div>
            <div className="text-xs text-muted-foreground mt-1">{dateRangeLabel}</div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">Revenue Recovered</div>
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div className="text-3xl font-bold">${metrics.estimatedRevenue.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Based on ${metrics.avgAppointmentValue} avg
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">Notifications Sent</div>
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div className="text-3xl font-bold">{metrics.notificationsSent}</div>
            <div className="text-xs text-muted-foreground mt-1">SMS to customers</div>
          </Card>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-1">Weekly Activity</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Openings created vs. booked
          </p>
          
          {metrics.weeklyData.length === 0 ? (
            <div className="flex h-[250px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-6">
              <div className="space-y-2 text-center">
                <p className="text-sm font-medium text-foreground">No weekly activity yet</p>
                <p className="mx-auto max-w-xs text-xs text-muted-foreground">
                  Weekly totals appear when customers book in this date range
                </p>
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
                    fill="hsl(var(--warning))" 
                    radius={[4, 4, 0, 0]} 
                  />
                  <Bar 
                    dataKey="slotsFilled" 
                    name="Booked"
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
              {/* Inline legend */}
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-3 h-3 rounded-sm bg-warning" />
                  <span>Openings</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-3 h-3 rounded-sm bg-primary" />
                  <span>Booked</span>
                </div>
              </div>
            </>
          )}
        </Card>
          </>
        )}
        </div>
      </div>
  );
};

export default Analytics;
