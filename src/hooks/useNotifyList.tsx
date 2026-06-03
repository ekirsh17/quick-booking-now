import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { isRequestActive } from "@/utils/notifyRequestActivity";

type StaffStatus = "any" | "active" | "inactive" | "missing";

export interface NotifyListItem {
  id: string;
  consumerId: string;
  consumerName: string;
  consumerPhone: string;
  staffId: string | null;
  staffName: string | null;
  staffStatus: StaffStatus;
  timeRange: string;
  createdAt: string;
  locationId: string | null;
  isActive: boolean;
}

export interface NotifyListSummary {
  activeCount: number;
  staffSpecificCount: number;
  anyStaffCount: number;
}

interface UseNotifyListResult {
  requests: NotifyListItem[];
  summary: NotifyListSummary;
  loading: boolean;
  error: Error | null;
  realtimeConnected: boolean;
  refetch: () => Promise<void>;
}

interface NotifyRequestConsumerRow {
  id: string | null;
  name: string | null;
  phone: string | null;
}

interface NotifyRequestRow {
  id: string;
  consumer_id: string | null;
  staff_id: string | null;
  time_range: string | null;
  created_at: string | null;
  location_id: string | null;
  consumer: NotifyRequestConsumerRow | NotifyRequestConsumerRow[] | null;
}

export const useNotifyList = (
  locationId: string | null | undefined,
  locationTimeZone: string | null | undefined
): UseNotifyListResult => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<NotifyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const fetchNotifyList = useCallback(async () => {
    if (!user?.id || !locationId) {
      setRequests([]);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let resolvedTimeZone = locationTimeZone ?? null;
      if (!resolvedTimeZone) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("time_zone")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.warn("Failed to fetch merchant time zone for waitlist:", profileError);
        } else {
          resolvedTimeZone = (profile as { time_zone?: string | null } | null)?.time_zone ?? null;
        }
      }

      const timeZone =
        resolvedTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;

      const [{ data: requestRows, error: requestError }, { data: staffRows, error: staffError }] =
        await Promise.all([
          supabase
            .from("notify_requests")
            .select(`
              id,
              consumer_id,
              staff_id,
              time_range,
              created_at,
              location_id,
              consumer:consumers!notify_requests_consumer_id_fkey (
                id,
                name,
                phone
              )
            `)
            .eq("merchant_id", user.id)
            .eq("location_id", locationId)
            .order("created_at", { ascending: false }),
          supabase
            .from("staff")
            .select("id, name, active")
            .eq("merchant_id", user.id)
            .eq("location_id", locationId),
        ]);

      if (requestError) throw requestError;
      if (staffError) throw staffError;

      const staffMap = new Map<string, { name: string | null; active: boolean | null }>();
      (staffRows || []).forEach((staff) => {
        staffMap.set(staff.id, { name: staff.name, active: staff.active });
      });

      const resolved = ((requestRows || []) as NotifyRequestRow[])
        .map((row) => {
          const consumer = Array.isArray(row.consumer) ? row.consumer[0] : row.consumer;
          const staffId = row.staff_id || null;
          const staffRecord = staffId ? staffMap.get(staffId) : null;

          let staffStatus: StaffStatus = "any";
          let staffName: string | null = null;

          if (staffId) {
            if (!staffRecord) {
              staffStatus = "missing";
              staffName = "Unknown/Inactive staff";
            } else if (staffRecord.active === false) {
              staffStatus = "inactive";
              staffName = staffRecord.name || "Unknown/Inactive staff";
            } else {
              staffStatus = "active";
              staffName = staffRecord.name || "Staff";
            }
          }

          const consumerId = row.consumer_id as string | null;
          const createdAt = row.created_at as string | null;
          const timeRange = (row.time_range as string | null) || "anytime";

          if (!consumerId || !createdAt) {
            return null;
          }

          return {
            id: row.id as string,
            consumerId,
            consumerName: consumer?.name || "Unknown Consumer",
            consumerPhone: consumer?.phone || "",
            staffId,
            staffName,
            staffStatus,
            timeRange,
            createdAt,
            locationId: row.location_id || null,
            isActive: isRequestActive(timeRange, createdAt, timeZone),
          } satisfies NotifyListItem;
        })
        .filter((item): item is NotifyListItem => item !== null)
        .filter((item) => item.isActive);

      setRequests(resolved);
    } catch (err) {
      setRequests([]);
      setError(err as Error);
      console.error("Failed to load waitlist:", err);
    } finally {
      setLoading(false);
    }
  }, [locationId, locationTimeZone, user?.id]);

  useEffect(() => {
    fetchNotifyList();
  }, [fetchNotifyList]);

  useEffect(() => {
    if (!user?.id || !locationId) {
      setRealtimeConnected(false);
      return;
    }

    const pollIntervalMs = 60_000;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => {
        void fetchNotifyList();
      }, pollIntervalMs);
    };

    const stopPolling = () => {
      if (!pollTimer) return;
      clearInterval(pollTimer);
      pollTimer = null;
    };

    startPolling();

    const channel = supabase
      .channel(`waitlist-${user.id}-${locationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notify_requests",
          filter: `merchant_id=eq.${user.id}`,
        },
        (payload) => {
          const newRow = payload.new as { location_id?: string | null } | null;
          const oldRow = payload.old as { location_id?: string | null } | null;
          const affectsLocation = newRow?.location_id === locationId || oldRow?.location_id === locationId;

          if (affectsLocation) {
            void fetchNotifyList();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "consumers",
        },
        () => {
          void fetchNotifyList();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeConnected(true);
          stopPolling();
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setRealtimeConnected(false);
          startPolling();
        }
      });

    return () => {
      setRealtimeConnected(false);
      stopPolling();
      supabase.removeChannel(channel);
    };
  }, [fetchNotifyList, locationId, user?.id]);

  const summary = useMemo<NotifyListSummary>(() => {
    const staffSpecificCount = requests.filter((request) => Boolean(request.staffId)).length;
    const anyStaffCount = requests.filter((request) => !request.staffId).length;

    return {
      activeCount: requests.length,
      staffSpecificCount,
      anyStaffCount,
    };
  }, [requests]);

  return {
    requests,
    summary,
    loading,
    error,
    realtimeConnected,
    refetch: fetchNotifyList,
  };
};
