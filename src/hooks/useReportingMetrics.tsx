import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useMerchantProfile } from './useMerchantProfile';

interface WeeklyData {
  week: string;
  weekLabel: string;
  slotsCreated: number;
  slotsFilled: number;
}

interface ReportingMetrics {
  slotsFilled: number;
  estimatedRevenue: number;
  notificationsSent: number;
  avgAppointmentValue: number;
  weeklyData: WeeklyData[];
}

interface UseReportingMetricsResult {
  metrics: ReportingMetrics;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching reporting metrics scoped to the current merchant.
 * Returns real data from Supabase with proper merchant scoping.
 */
export const useReportingMetrics = (): UseReportingMetricsResult => {
  const { user } = useAuth();
  const { profile } = useMerchantProfile();
  
  const [metrics, setMetrics] = useState<ReportingMetrics>({
    slotsFilled: 0,
    estimatedRevenue: 0,
    notificationsSent: 0,
    avgAppointmentValue: 70, // Default fallback
    weeklyData: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Calculate date range: last 30 days for KPIs, last 4 weeks for chart
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const fourWeeksAgo = new Date(now);
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

      // Fetch slots for the merchant (last 30 days)
      const { data: slots, error: slotsError } = await supabase
        .from('slots')
        .select('id, status, start_time, created_at')
        .eq('merchant_id', user.id)
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (slotsError) throw slotsError;

      // Fetch notifications count (last 30 days)
      const { count: notificationCount, error: notifError } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', user.id)
        .gte('sent_at', thirtyDaysAgo.toISOString());

      if (notifError) throw notifError;

      // Calculate metrics
      const filledSlots = slots?.filter(s => s.status === 'booked') || [];
      const slotsFilled = filledSlots.length;
      
      // Use profile's default value or fallback
      const avgValue = profile?.default_opening_duration 
        ? Math.round(profile.default_opening_duration * 2.33) // Rough estimate: $2.33/min
        : 70;

      // Group slots by week for chart data
      const weeklyData = calculateWeeklyData(slots || [], fourWeeksAgo);

      setMetrics({
        slotsFilled,
        estimatedRevenue: slotsFilled * avgValue,
        notificationsSent: notificationCount || 0,
        avgAppointmentValue: avgValue,
        weeklyData,
      });
    } catch (err) {
      console.error('Error fetching reporting metrics:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [user, profile?.default_opening_duration]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return {
    metrics,
    loading,
    error,
    refetch: fetchMetrics,
  };
};

/**
 * Groups slots by week and calculates created vs filled counts.
 */
function calculateWeeklyData(
  slots: Array<{ id: string; status: string | null; start_time: string | null; created_at: string | null }>,
  startDate: Date
): WeeklyData[] {
  const weeks: WeeklyData[] = [];
  const now = new Date();

  // Generate 4 weeks of data
  for (let i = 0; i < 4; i++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + (i * 7));
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Don't include future weeks
    if (weekStart > now) break;

    const weekSlots = slots.filter(slot => {
      const createdAt = slot.created_at ? new Date(slot.created_at) : null;
      return createdAt && createdAt >= weekStart && createdAt < weekEnd;
    });

    const slotsCreated = weekSlots.length;
    const slotsFilled = weekSlots.filter(s => s.status === 'booked').length;

    // Format week label (e.g., "Nov 18")
    const weekLabel = weekStart.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });

    weeks.push({
      week: weekStart.toISOString(),
      weekLabel,
      slotsCreated,
      slotsFilled,
    });
  }

  return weeks;
}

export default useReportingMetrics;

