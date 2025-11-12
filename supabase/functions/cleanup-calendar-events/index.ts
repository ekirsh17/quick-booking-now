import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const encryptionKey = Deno.env.get('CALENDAR_ENCRYPTION_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { accountId, deleteEvents } = await req.json();

    if (!accountId) {
      throw new Error('Missing accountId');
    }

    // Verify account belongs to user
    const { data: account, error: accountError } = await supabase
      .from('external_calendar_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('merchant_id', user.id)
      .single();

    if (accountError || !account) {
      throw new Error('Calendar account not found');
    }

    let eventsDeleted = 0;

    if (deleteEvents) {
      console.log('Deleting events from Google Calendar...');

      // Decrypt credentials
      const { data: decryptedData, error: decryptError } = await supabase.rpc(
        'decrypt_calendar_credentials',
        {
          encrypted_data: account.encrypted_credentials,
          encryption_key: encryptionKey,
        }
      );

      if (decryptError) {
        console.error('Decryption error:', decryptError);
        throw new Error('Failed to decrypt credentials');
      }

      const credentials = decryptedData;
      const accessToken = credentials.access_token;

      // Fetch all calendar events for this account
      const { data: calendarEvents, error: eventsError } = await supabase
        .from('external_calendar_events')
        .select('*')
        .eq('account_id', accountId);

      if (eventsError) {
        console.error('Error fetching calendar events:', eventsError);
      } else if (calendarEvents && calendarEvents.length > 0) {
        console.log(`Deleting ${calendarEvents.length} events from Google Calendar`);

        for (const event of calendarEvents) {
          try {
            // Delete from Google Calendar
            const deleteUrl = `https://www.googleapis.com/calendar/v3/calendars/${event.calendar_id}/events/${event.external_event_id}`;
            const deleteResponse = await fetch(deleteUrl, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            });

            if (deleteResponse.ok || deleteResponse.status === 404) {
              // 404 means already deleted, which is fine
              eventsDeleted++;
              console.log(`Deleted event ${event.external_event_id}`);
            } else {
              console.error(`Failed to delete event ${event.external_event_id}:`, deleteResponse.status);
            }
          } catch (error) {
            console.error(`Error deleting event ${event.external_event_id}:`, error);
          }
        }

        // Delete calendar event records from database
        await supabase
          .from('external_calendar_events')
          .delete()
          .eq('account_id', accountId);
      }
    }

    // Delete the calendar account
    const { error: deleteError } = await supabase
      .from('external_calendar_accounts')
      .delete()
      .eq('id', accountId);

    if (deleteError) {
      throw deleteError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        eventsDeleted,
        message: deleteEvents 
          ? `Disconnected and removed ${eventsDeleted} event${eventsDeleted !== 1 ? 's' : ''} from Google Calendar`
          : 'Disconnected calendar (events kept in Google Calendar)'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Cleanup error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
