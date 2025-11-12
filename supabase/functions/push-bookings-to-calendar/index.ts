import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Slot {
  id: string;
  merchant_id: string;
  start_time: string;
  end_time: string;
  appointment_name: string | null;
  booked_by_name: string | null;
  consumer_phone: string | null;
  status: string;
}

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

    const encryptionKey = Deno.env.get('CALENDAR_ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    // Get request body to check if specific slot_id provided
    const body = await req.json().catch(() => ({}));
    const specificSlotId = body?.slot_id;

    console.log('Push bookings to calendar:', { userId: user.id, specificSlotId });

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
    let totalErrors = 0;

    // Get booked slots that need syncing
    let slotsQuery = supabase
      .from('slots')
      .select('*')
      .eq('merchant_id', user.id)
      .eq('status', 'booked')
      .is('deleted_at', null);

    if (specificSlotId) {
      slotsQuery = slotsQuery.eq('id', specificSlotId);
    }

    const { data: bookedSlots, error: slotsError } = await slotsQuery;

    if (slotsError) {
      throw slotsError;
    }

    if (!bookedSlots || bookedSlots.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No booked slots to sync', synced: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${bookedSlots.length} booked slots to sync`);

    // Use the first connected account (in future, could support multiple calendars)
    const account = accounts[0];

    // Decrypt credentials
    const { data: credentials, error: decryptError } = await serviceRoleSupabase.rpc(
      'decrypt_calendar_credentials',
      {
        encrypted_data: account.encrypted_credentials,
        encryption_key: encryptionKey,
      }
    );

    if (decryptError || !credentials) {
      console.error('Failed to decrypt credentials:', decryptError);
      throw new Error('Failed to decrypt calendar credentials');
    }

    console.log('Credentials decrypted, checking token expiry:', {
      hasAccessToken: !!credentials.access_token,
      hasRefreshToken: !!credentials.refresh_token,
      expiresAt: credentials.expires_at,
      isExpired: credentials.expires_at ? Date.now() > credentials.expires_at : 'unknown'
    });

    // Get the primary calendar ID
    const calendarsResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      {
        headers: { Authorization: `Bearer ${credentials.access_token}` },
      }
    );

    if (!calendarsResponse.ok) {
      const errorText = await calendarsResponse.text();
      console.error('Failed to fetch calendars:', {
        status: calendarsResponse.status,
        statusText: calendarsResponse.statusText,
        error: errorText
      });
      throw new Error(`Failed to fetch calendars: ${calendarsResponse.status} - ${errorText}`);
    }

    const calendarsData = await calendarsResponse.json();
    const primaryCalendar = calendarsData.items?.find((cal: any) => cal.primary) || calendarsData.items?.[0];

    if (!primaryCalendar) {
      throw new Error('No calendar found');
    }

    console.log(`Using calendar: ${primaryCalendar.id}`);

    // Sync each booked slot
    for (const slot of bookedSlots as Slot[]) {
      try {
        // Check if already synced
        const { data: existingEvent } = await serviceRoleSupabase
          .from('external_calendar_events')
          .select('*')
          .eq('slot_id', slot.id)
          .eq('account_id', account.id)
          .single();

        if (existingEvent && existingEvent.status === 'created') {
          console.log(`Slot ${slot.id} already synced, skipping`);
          continue;
        }

        // Create calendar event
        const eventTitle = slot.appointment_name || 'Booking';
        const customerInfo = slot.booked_by_name 
          ? `\nCustomer: ${slot.booked_by_name}`
          : '';
        const phoneInfo = slot.consumer_phone
          ? `\nPhone: ${slot.consumer_phone}`
          : '';

        const calendarEvent = {
          summary: eventTitle,
          description: `Booked appointment${customerInfo}${phoneInfo}`,
          start: {
            dateTime: slot.start_time,
            timeZone: 'UTC',
          },
          end: {
            dateTime: slot.end_time,
            timeZone: 'UTC',
          },
        };

        const createEventResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(primaryCalendar.id)}/events`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${credentials.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(calendarEvent),
          }
        );

        if (!createEventResponse.ok) {
          const errorText = await createEventResponse.text();
          console.error(`Failed to create event for slot ${slot.id}:`, errorText);
          totalErrors++;
          continue;
        }

        const createdEvent = await createEventResponse.json();
        console.log(`Created calendar event ${createdEvent.id} for slot ${slot.id}`);

        // Store the mapping
        await serviceRoleSupabase
          .from('external_calendar_events')
          .upsert({
            account_id: account.id,
            slot_id: slot.id,
            calendar_id: primaryCalendar.id,
            external_event_id: createdEvent.id,
            external_event_key: createdEvent.id,
            status: 'created',
            last_synced_at: new Date().toISOString(),
          }, {
            onConflict: 'slot_id,account_id',
          });

        totalSynced++;
      } catch (error) {
        console.error(`Error syncing slot ${slot.id}:`, error);
        totalErrors++;
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Calendar push completed',
        synced: totalSynced,
        errors: totalErrors,
        total: bookedSlots.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in push-bookings-to-calendar:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
