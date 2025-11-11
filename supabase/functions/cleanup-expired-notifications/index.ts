import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting cleanup of expired notification requests');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);

    let totalDeleted = 0;

    // Delete "today" requests older than 1 day
    const { data: todayDeleted, error: todayError } = await supabase
      .from('notify_requests')
      .delete()
      .eq('time_range', 'today')
      .lt('created_at', yesterday.toISOString())
      .select('id');

    if (todayError) {
      console.error('Error deleting today requests:', todayError);
    } else {
      console.log(`Deleted ${todayDeleted?.length || 0} expired "today" requests`);
      totalDeleted += todayDeleted?.length || 0;
    }

    // Delete "tomorrow" requests older than 2 days
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const { data: tomorrowDeleted, error: tomorrowError } = await supabase
      .from('notify_requests')
      .delete()
      .eq('time_range', 'tomorrow')
      .lt('created_at', twoDaysAgo.toISOString())
      .select('id');

    if (tomorrowError) {
      console.error('Error deleting tomorrow requests:', tomorrowError);
    } else {
      console.log(`Deleted ${tomorrowDeleted?.length || 0} expired "tomorrow" requests`);
      totalDeleted += tomorrowDeleted?.length || 0;
    }

    // Delete "this_week" requests older than 7 days
    const { data: weekDeleted, error: weekError } = await supabase
      .from('notify_requests')
      .delete()
      .eq('time_range', 'this_week')
      .lt('created_at', weekAgo.toISOString())
      .select('id');

    if (weekError) {
      console.error('Error deleting this_week requests:', weekError);
    } else {
      console.log(`Deleted ${weekDeleted?.length || 0} expired "this_week" requests`);
      totalDeleted += weekDeleted?.length || 0;
    }

    // Delete "next_week" requests older than 14 days
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const { data: nextWeekDeleted, error: nextWeekError } = await supabase
      .from('notify_requests')
      .delete()
      .eq('time_range', 'next_week')
      .lt('created_at', twoWeeksAgo.toISOString())
      .select('id');

    if (nextWeekError) {
      console.error('Error deleting next_week requests:', nextWeekError);
    } else {
      console.log(`Deleted ${nextWeekDeleted?.length || 0} expired "next_week" requests`);
      totalDeleted += nextWeekDeleted?.length || 0;
    }

    console.log(`Cleanup complete. Total deleted: ${totalDeleted}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deleted: totalDeleted,
        message: `Cleaned up ${totalDeleted} expired notification requests`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in cleanup-expired-notifications:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error',
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
