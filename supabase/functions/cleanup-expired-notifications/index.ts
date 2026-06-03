import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { isRequestActive } from "../shared/notifyRequestTime.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_TIME_ZONE = "America/New_York";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting cleanup of expired notification requests");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    let totalDeleted = 0;

    const { data: todayDeleted, error: todayError } = await supabase
      .from("notify_requests")
      .delete()
      .eq("time_range", "today")
      .lt("created_at", yesterday.toISOString())
      .select("id");

    if (todayError) {
      console.error("Error deleting today requests:", todayError);
    } else {
      totalDeleted += todayDeleted?.length || 0;
    }

    const { data: tomorrowDeleted, error: tomorrowError } = await supabase
      .from("notify_requests")
      .delete()
      .eq("time_range", "tomorrow")
      .lt("created_at", twoDaysAgo.toISOString())
      .select("id");

    if (tomorrowError) {
      console.error("Error deleting tomorrow requests:", tomorrowError);
    } else {
      totalDeleted += tomorrowDeleted?.length || 0;
    }

    const { data: weekDeleted, error: weekError } = await supabase
      .from("notify_requests")
      .delete()
      .eq("time_range", "this_week")
      .lt("created_at", weekAgo.toISOString())
      .select("id");

    if (weekError) {
      console.error("Error deleting this_week requests:", weekError);
    } else {
      totalDeleted += weekDeleted?.length || 0;
    }

    const { data: nextWeekDeleted, error: nextWeekError } = await supabase
      .from("notify_requests")
      .delete()
      .eq("time_range", "next_week")
      .lt("created_at", twoWeeksAgo.toISOString())
      .select("id");

    if (nextWeekError) {
      console.error("Error deleting next_week requests:", nextWeekError);
    } else {
      totalDeleted += nextWeekDeleted?.length || 0;
    }

    const { data: candidateRows, error: candidateError } = await supabase
      .from("notify_requests")
      .select(`
        id,
        time_range,
        created_at,
        profiles!notify_requests_merchant_id_fkey (
          time_zone
        )
      `)
      .like("time_range", "____-__-__");

    if (candidateError) {
      console.error("Error fetching date-key notify requests:", candidateError);
    } else {
      const expiredIds = (candidateRows || [])
        .filter((row: {
          id: string;
          time_range: string | null;
          created_at: string | null;
          profiles: { time_zone: string | null } | { time_zone: string | null }[] | null;
        }) => {
          if (!row.time_range || !row.created_at) return false;
          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
          const timeZone = profile?.time_zone || DEFAULT_TIME_ZONE;
          return !isRequestActive(row.time_range, row.created_at, timeZone, now);
        })
        .map((row: { id: string }) => row.id);

      if (expiredIds.length > 0) {
        const { data: deletedDates, error: deleteDateError } = await supabase
          .from("notify_requests")
          .delete()
          .in("id", expiredIds)
          .select("id");

        if (deleteDateError) {
          console.error("Error deleting date-key/range requests:", deleteDateError);
        } else {
          totalDeleted += deletedDates?.length || 0;
        }
      }
    }

    const rollingPresets = ["3-days", "5-days", "1-week"];
    const { data: rollingRows, error: rollingError } = await supabase
      .from("notify_requests")
      .select(`
        id,
        time_range,
        created_at,
        profiles!notify_requests_merchant_id_fkey (
          time_zone
        )
      `)
      .in("time_range", rollingPresets);

    if (rollingError) {
      console.error("Error fetching rolling preset notify requests:", rollingError);
    } else {
      const expiredRollingIds = (rollingRows || [])
        .filter((row: {
          id: string;
          time_range: string | null;
          created_at: string | null;
          profiles: { time_zone: string | null } | { time_zone: string | null }[] | null;
        }) => {
          if (!row.time_range || !row.created_at) return false;
          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
          const timeZone = profile?.time_zone || DEFAULT_TIME_ZONE;
          return !isRequestActive(row.time_range, row.created_at, timeZone, now);
        })
        .map((row: { id: string }) => row.id);

      if (expiredRollingIds.length > 0) {
        const { data: deletedRolling, error: deleteRollingError } = await supabase
          .from("notify_requests")
          .delete()
          .in("id", expiredRollingIds)
          .select("id");

        if (deleteRollingError) {
          console.error("Error deleting rolling preset requests:", deleteRollingError);
        } else {
          totalDeleted += deletedRolling?.length || 0;
        }
      }
    }

    console.log(`Cleanup complete. Total deleted: ${totalDeleted}`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted: totalDeleted,
        message: `Cleaned up ${totalDeleted} expired notification requests`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in cleanup-expired-notifications:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
