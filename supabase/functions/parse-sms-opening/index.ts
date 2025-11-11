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

  let fromNumber: string | undefined;
  
  try {
    // Parse form-encoded data from Twilio webhook
    const formData = await req.formData();
    const Body = formData.get('Body')?.toString();
    const From = formData.get('From')?.toString();
    const messageBody = Body?.trim();
    fromNumber = From;

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
      await sendSMS(fromNumber, 'Phone number not registered. Please register at your NotifyMe dashboard first.').catch(console.error);
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

    // Parse the SMS with AI, fallback to simple parser
    let parsed: OpeningRequest;
    try {
      console.info('Attempting AI parse...');
      parsed = await parseWithAI(messageBody, merchant);
    } catch (aiError) {
      console.warn('AI parsing failed, using fallback:', aiError);
      parsed = await parseSimple(messageBody, merchant);
    }

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
    
    // Send SMS notification to user
    if (fromNumber) {
      const userMsg = errorMessage.includes('conflict') 
        ? errorMessage
        : 'Sorry, there was a temporary issue creating your opening. Please try again.';
      await sendSMS(fromNumber, userMsg).catch(console.error);
    }
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function parseWithAI(message: string, merchant: any): Promise<OpeningRequest> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

  const systemPrompt = `You are a scheduling assistant for ${merchant.business_name}. Parse SMS messages to extract appointment details.

Merchant context:
- Business: ${merchant.business_name}
- Time zone: ${merchant.time_zone}
- Common appointment types: ${merchant.saved_appointment_names?.join(', ') || 'None'}
- Common durations: ${merchant.saved_durations?.join(', ') || '30'} minutes
- Default duration: ${merchant.default_opening_duration || 30} minutes
- Working hours: ${JSON.stringify(merchant.working_hours)}

Current date/time: ${new Date().toLocaleString('en-US', { timeZone: merchant.time_zone })}

Parse the message and return ONLY valid JSON with these exact fields:
{
  "date": "YYYY-MM-DD (ISO date string. If relative like today/tomorrow, convert to actual date)",
  "time": "HH:MM (24-hour format)",
  "duration": number (in minutes),
  "appointmentName": "string or null",
  "staffName": "string or null",
  "confidence": "high|medium|low",
  "needsClarification": boolean,
  "clarificationQuestion": "string or null"
}

IMPORTANT RULES:
1. Merchants typically say "Add 2pm opening" not "Add evening opening"
2. If time is unclear, set needsClarification=true
3. If date is unclear, assume today
4. Use default duration if not specified
5. Match appointment names to merchant's common types when possible
6. Return ONLY valid JSON, no markdown or explanation`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Lovable AI error:', error);
      throw new Error('AI parsing failed');
    }

    const data = await response.json();
    let content = data.choices[0].message.content.trim();
    
    // Strip markdown code fences if present
    if (content.startsWith('```json')) {
      content = content.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (content.startsWith('```')) {
      content = content.replace(/^```\n/, '').replace(/\n```$/, '');
    }
    
    const parsed = JSON.parse(content);
    console.info('AI parsed successfully:', parsed);
    return parsed;
  } catch (error) {
    console.error('AI parsing error:', error);
    throw error;
  }
}

async function parseSimple(message: string, merchant: any): Promise<OpeningRequest> {
  console.info('Using fallback parser');
  
  const msg = message.toLowerCase();
  const result: OpeningRequest = {
    confidence: 'low',
    needsClarification: false,
  };

  // Extract time: 2pm, 2:30pm, 14:00, etc.
  const timeMatch = msg.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const ampm = timeMatch[3];

    if (ampm === 'pm' && hours !== 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;

    result.time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  // Extract date: today, tomorrow, or weekday
  const today = new Date();
  const tzOffset = new Date().toLocaleString('en-US', { timeZone: merchant.time_zone });
  const merchantToday = new Date(tzOffset);
  
  if (msg.includes('tomorrow')) {
    merchantToday.setDate(merchantToday.getDate() + 1);
  } else if (msg.includes('monday') || msg.includes('tuesday') || msg.includes('wednesday') || 
             msg.includes('thursday') || msg.includes('friday') || msg.includes('saturday') || msg.includes('sunday')) {
    // Find next occurrence of that weekday
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = weekdays.findIndex(day => msg.includes(day));
    const currentDay = merchantToday.getDay();
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7; // Next week
    merchantToday.setDate(merchantToday.getDate() + daysToAdd);
  }
  
  result.date = merchantToday.toISOString().split('T')[0];

  // Extract duration: 30 min, 45 minutes, etc.
  const durationMatch = msg.match(/(\d{1,3})\s*(min|mins|minutes)/);
  result.duration = durationMatch ? parseInt(durationMatch[1]) : merchant.default_opening_duration || 30;

  // Extract appointment name (simple keyword matching)
  const commonTypes = ['haircut', 'consultation', 'massage', 'facial', 'manicure', 'pedicure', 'color', 'trim'];
  for (const type of commonTypes) {
    if (msg.includes(type)) {
      result.appointmentName = type.charAt(0).toUpperCase() + type.slice(1);
      break;
    }
  }

  // Check if we have critical info
  if (!result.time) {
    result.needsClarification = true;
    result.clarificationQuestion = 'What time would you like the opening? (e.g., 2pm, 14:00)';
  }

  console.info('Fallback parsed:', result);
  return result;
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

  // Parse date and time in merchant's timezone
  // Format: "YYYY-MM-DDTHH:MM" in merchant local time, convert to ISO with timezone
  const localDateTimeStr = `${parsed.date}T${parsed.time}`;
  
  // Create date in merchant's timezone by using Intl API
  const merchantTz = merchant.time_zone || 'America/New_York';
  
  // Parse as if it's in the merchant's timezone
  const parts = localDateTimeStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!parts) throw new Error('Invalid date/time format');
  
  const [, year, month, day, hour, minute] = parts;
  
  // Create a date string that will be interpreted correctly
  // Using toLocaleString to format in merchant TZ, then parse back to get UTC
  const localDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
  
  // Get timezone offset for merchant's timezone at this date
  const tzFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: merchantTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  // Format current time in merchant TZ to find offset
  const nowInMerchantTz = new Date(tzFormatter.format(new Date()));
  const nowInUTC = new Date();
  const offsetMinutes = (nowInUTC.getTime() - nowInMerchantTz.getTime()) / 60000;
  
  // Apply offset to get UTC time
  const startDateTime = new Date(localDate.getTime() - offsetMinutes * 60000);
  const endDateTime = new Date(startDateTime.getTime() + (parsed.duration || merchant.default_opening_duration || 30) * 60000);

  // Check for conflicts
  const { data: hasConflict } = await supabase.rpc('check_slot_conflict', {
    p_merchant_id: merchant.id,
    p_staff_id: staffId,
    p_start_time: startDateTime.toISOString(),
    p_end_time: endDateTime.toISOString(),
  });

  if (hasConflict) {
    const conflictMsg = `Time slot conflict detected for ${parsed.date} at ${parsed.time}. Please choose a different time.`;
    console.warn('Conflict detected:', conflictMsg);
    throw new Error(conflictMsg);
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
  
  let parsed: OpeningRequest;
  try {
    parsed = await parseWithAI(fullContext, merchant);
  } catch (aiError) {
    console.warn('AI clarification parsing failed, using fallback:', aiError);
    parsed = await parseSimple(fullContext, merchant);
  }

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
