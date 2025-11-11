import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OpeningRequest {
  date?: string;
  time?: string;
  duration?: number;
  appointmentName?: string;
  staffName?: string;
  confidence: 'high' | 'medium' | 'low';
  needsClarification?: boolean;
  clarificationQuestion?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { Body, From } = await req.json();
    const messageBody = Body?.trim();
    const fromNumber = From;

    console.log(`Received SMS from ${fromNumber}: ${messageBody}`);

    if (!messageBody || !fromNumber) {
      throw new Error('Missing required fields: Body or From');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find merchant by phone number
    const { data: merchant, error: merchantError } = await supabase
      .from('profiles')
      .select('id, business_name, time_zone, saved_appointment_names, saved_durations, default_opening_duration, working_hours')
      .eq('phone', fromNumber)
      .single();

    if (merchantError || !merchant) {
      console.error('Merchant not found:', merchantError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Phone number not registered. Please register at your NotifyMe dashboard first.' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for undo command (within 5 minutes)
    const undoKeywords = ['undo', 'cancel', 'delete', 'cancel last', 'delete that', 'undo that'];
    const isUndoCommand = undoKeywords.some(keyword => 
      messageBody.toLowerCase().includes(keyword)
    );

    if (isUndoCommand) {
      return await handleUndo(supabase, merchant.id, fromNumber);
    }

    // Check for clarification response
    const { data: pendingState } = await supabase
      .from('sms_intake_state')
      .select('*')
      .eq('merchant_id', merchant.id)
      .eq('phone_number', fromNumber)
      .eq('state', 'pending_clarification')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (pendingState) {
      return await handleClarificationResponse(supabase, pendingState, messageBody, merchant);
    }

    // Parse the SMS with OpenAI
    const parsed = await parseWithOpenAI(messageBody, merchant);

    // If needs clarification, save state and send question
    if (parsed.needsClarification) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      await supabase
        .from('sms_intake_state')
        .insert({
          merchant_id: merchant.id,
          phone_number: fromNumber,
          original_message: messageBody,
          parsed_data: parsed,
          clarification_question: parsed.clarificationQuestion,
          expires_at: expiresAt.toISOString(),
        });

      // Send clarification SMS
      await sendSMS(fromNumber, parsed.clarificationQuestion || 'Please clarify your request.');

      return new Response(
        JSON.stringify({ success: true, needsClarification: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the opening
    const opening = await createOpening(supabase, merchant, parsed);

    // Send confirmation SMS
    const confirmationMsg = `Opening created: ${parsed.appointmentName || 'Appointment'} on ${parsed.date} at ${parsed.time} (${parsed.duration} min). Reply "undo" within 5 min to cancel.`;
    await sendSMS(fromNumber, confirmationMsg);

    return new Response(
      JSON.stringify({ success: true, opening }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing SMS:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function parseWithOpenAI(message: string, merchant: any): Promise<OpeningRequest> {
  const openAIKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIKey) throw new Error('OpenAI API key not configured');

  const systemPrompt = `You are a scheduling assistant for ${merchant.business_name}. Parse SMS messages to extract appointment details.

Merchant context:
- Business: ${merchant.business_name}
- Time zone: ${merchant.time_zone}
- Common appointment types: ${merchant.saved_appointment_names?.join(', ') || 'None'}
- Common durations: ${merchant.saved_durations?.join(', ') || '30'} minutes
- Default duration: ${merchant.default_opening_duration || 30} minutes
- Working hours: ${JSON.stringify(merchant.working_hours)}

Current date/time: ${new Date().toLocaleString('en-US', { timeZone: merchant.time_zone })}

Parse the message and extract:
- date: ISO date string (YYYY-MM-DD). If relative (today, tomorrow, next Monday), convert to actual date.
- time: 24-hour format (HH:MM). If merchant says "2pm", parse as "14:00".
- duration: in minutes
- appointmentName: type of appointment (haircut, consultation, etc.)
- staffName: if mentioned
- confidence: high/medium/low based on clarity
- needsClarification: true if critical info is missing
- clarificationQuestion: specific question to ask if clarification needed

IMPORTANT RULES:
1. Merchants typically say "Add 2pm opening" not "Add evening opening"
2. If time is unclear, set needsClarification=true
3. If date is unclear, assume today
4. Use default duration if not specified
5. Match appointment names to merchant's common types when possible`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI API error:', error);
    throw new Error('Failed to parse message with AI');
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  const parsed = JSON.parse(content);

  console.log('OpenAI parsed:', parsed);
  return parsed;
}

async function createOpening(supabase: any, merchant: any, parsed: OpeningRequest) {
  // Find staff if specified
  let staffId = null;
  if (parsed.staffName) {
    const { data: staff } = await supabase
      .from('staff')
      .select('id')
      .eq('merchant_id', merchant.id)
      .ilike('name', `%${parsed.staffName}%`)
      .eq('active', true)
      .single();
    staffId = staff?.id || null;
  }

  // Parse date and time
  const startDateTime = new Date(`${parsed.date}T${parsed.time}`);
  const endDateTime = new Date(startDateTime.getTime() + (parsed.duration || merchant.default_opening_duration || 30) * 60000);

  // Check for conflicts
  const { data: hasConflict } = await supabase.rpc('check_slot_conflict', {
    p_merchant_id: merchant.id,
    p_staff_id: staffId,
    p_start_time: startDateTime.toISOString(),
    p_end_time: endDateTime.toISOString(),
  });

  if (hasConflict) {
    throw new Error('Time slot conflict detected. Please choose a different time.');
  }

  // Create the opening
  const { data: opening, error } = await supabase
    .from('slots')
    .insert({
      merchant_id: merchant.id,
      staff_id: staffId,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      duration_minutes: parsed.duration || merchant.default_opening_duration || 30,
      appointment_name: parsed.appointmentName || null,
      created_via: 'sms',
      status: 'open',
    })
    .select()
    .single();

  if (error) throw error;
  return opening;
}

async function handleUndo(supabase: any, merchantId: string, fromNumber: string) {
  // Find most recent SMS-created opening within 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const { data: recentOpening } = await supabase
    .from('slots')
    .select('*')
    .eq('merchant_id', merchantId)
    .eq('created_via', 'sms')
    .eq('status', 'open')
    .is('deleted_at', null)
    .gte('created_at', fiveMinutesAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!recentOpening) {
    await sendSMS(fromNumber, 'No recent opening found to undo (must be within 5 minutes and not booked).');
    return new Response(
      JSON.stringify({ success: false, message: 'No opening to undo' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Soft-delete the opening
  const { error } = await supabase
    .from('slots')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', recentOpening.id);

  if (error) throw error;

  const confirmMsg = `Opening deleted: ${recentOpening.appointment_name || 'Appointment'} on ${new Date(recentOpening.start_time).toLocaleDateString()}.`;
  await sendSMS(fromNumber, confirmMsg);

  return new Response(
    JSON.stringify({ success: true, deleted: recentOpening }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleClarificationResponse(supabase: any, state: any, response: string, merchant: any) {
  // Re-parse with clarification context
  const fullContext = `Original request: ${state.original_message}\nClarification: ${response}`;
  const parsed = await parseWithOpenAI(fullContext, merchant);

  if (parsed.needsClarification) {
    // Still needs clarification - send another question
    await supabase
      .from('sms_intake_state')
      .update({ clarification_question: parsed.clarificationQuestion })
      .eq('id', state.id);

    await sendSMS(state.phone_number, parsed.clarificationQuestion!);

    return new Response(
      JSON.stringify({ success: true, needsClarification: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create the opening
  const opening = await createOpening(supabase, merchant, parsed);

  // Mark state as resolved
  await supabase
    .from('sms_intake_state')
    .update({ state: 'resolved' })
    .eq('id', state.id);

  // Send confirmation
  const confirmationMsg = `Opening created: ${parsed.appointmentName || 'Appointment'} on ${parsed.date} at ${parsed.time} (${parsed.duration} min). Reply "undo" within 5 min to cancel.`;
  await sendSMS(state.phone_number, confirmationMsg);

  return new Response(
    JSON.stringify({ success: true, opening }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function sendSMS(to: string, message: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    await supabase.functions.invoke('send-sms', {
      body: { to, message }
    });
  } catch (error) {
    console.error('Error sending SMS:', error);
  }
}
