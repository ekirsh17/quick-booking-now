import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('default_location_id')
      .eq('id', user.id)
      .maybeSingle();
    const fallbackLocationId = profile?.default_location_id ?? null;

    const encryptionKey = Deno.env.get('CALENDAR_ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    // Get connected calendar accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('external_calendar_accounts')
      .select('*')
      .eq('merchant_id', user.id)
      .eq('provider', 'google')
      .eq('status', 'connected');

    if (accountsError) {
      throw accountsError;
    }

    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No connected calendar accounts' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceRoleSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let totalSynced = 0;

    for (const account of accounts) {
      try {
        const accountLocationId = account.location_id || fallbackLocationId;

        // Decrypt credentials
        const { data: credentials, error: decryptError } = await serviceRoleSupabase.rpc(
          'decrypt_calendar_credentials',
          {
            encrypted_data: account.encrypted_credentials,
            encryption_key: encryptionKey,
          }
        );

        if (decryptError || !credentials) {
          console.error('Failed to decrypt credentials for account:', account.id);
          continue;
        }

        // Get calendars
        const calendarsResponse = await fetch(
          'https://www.googleapis.com/calendar/v3/users/me/calendarList',
          {
            headers: { Authorization: `Bearer ${credentials.access_token}` },
          }
        );

        if (!calendarsResponse.ok) {
          console.error('Failed to fetch calendars for account:', account.id);
          continue;
        }

        const calendarsData = await calendarsResponse.json();

        // Get events from each calendar
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        for (const calendar of calendarsData.items) {
          const eventsResponse = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?` +
            new URLSearchParams({
              timeMin: now.toISOString(),
              timeMax: thirtyDaysFromNow.toISOString(),
              singleEvents: 'true',
              orderBy: 'startTime',
            }),
            {
              headers: { Authorization: `Bearer ${credentials.access_token}` },
            }
          );

          if (!eventsResponse.ok) {
            console.error('Failed to fetch events for calendar:', calendar.id);
            continue;
          }

          const eventsData = await eventsResponse.json();

          // Create blocked slots for each event
          for (const event of eventsData.items) {
            if (!event.start?.dateTime || !event.end?.dateTime) continue;

            const startTime = new Date(event.start.dateTime);
            const endTime = new Date(event.end.dateTime);
            const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

            // Check if slot already exists
            const { data: existingSlot } = await supabase
              .from('slots')
              .select('id')
              .eq('merchant_id', user.id)
              .eq('start_time', startTime.toISOString())
              .eq('end_time', endTime.toISOString())
              .single();

            if (existingSlot) continue;

            // Create blocked slot
            const { error: slotError } = await supabase
              .from('slots')
              .insert({
                merchant_id: user.id,
                location_id: accountLocationId,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                duration_minutes: durationMinutes,
                status: 'blocked',
                appointment_name: `Blocked: ${event.summary || 'Calendar Event'}`,
                created_via: 'calendar_sync',
              });

            if (!slotError) {
              totalSynced++;
            }
          }
        }
      } catch (error) {
        console.error('Error processing account:', account.id, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Calendar sync completed',
        synced: totalSynced 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in sync-calendar-events:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
