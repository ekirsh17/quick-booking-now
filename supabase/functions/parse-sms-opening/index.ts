import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DateTime } from "https://esm.sh/luxon@3.5.0";

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
  suggestedAppointmentName?: string;
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

    // Check for special commands
    const lowerBody = messageBody.toLowerCase().trim();
    
    // Help command
    if (lowerBody === 'help' || lowerBody === 'commands') {
      const helpMsg = `${merchant.business_name} SMS Commands:

• Add: "2pm haircut" or "tomorrow 3pm"
• Undo: "undo" (within 5 min)
• Help: "help"

Examples:
"1pm" - Add 1pm opening
"2:30pm massage" - 2:30pm massage
"tomorrow 10am" - Tomorrow at 10am
"Fri 3pm" - Friday at 3pm`;
      
      await sendSMS(fromNumber, helpMsg);
      return new Response(
        JSON.stringify({ success: true, command: 'help' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Undo command
    const undoKeywords = ['undo', 'cancel', 'delete', 'cancel last', 'delete that', 'undo that'];
    const isUndoCommand = undoKeywords.some(keyword => lowerBody.includes(keyword));

    if (isUndoCommand) {
      return await handleUndo(supabase, merchant.id, merchant, fromNumber);
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

    // Send confirmation SMS with industry-standard formatting
    const merchantTz = merchant.time_zone || 'America/New_York';
    const startTime = DateTime.fromISO(`${parsed.date}T${parsed.time}`, { zone: merchantTz });
    const timeStr = startTime.toFormat('h:mm a');
    
    // Format date as "today", "tomorrow", or "Mon, Nov 11" in merchant timezone
    const nowMerchant = DateTime.now().setZone(merchantTz);
    const todayMerchant = nowMerchant.startOf('day');
    const tomorrowMerchant = todayMerchant.plus({ days: 1 });
    const openingDate = DateTime.fromISO(parsed.date || '', { zone: merchantTz }).startOf('day');
    
    let dateStr;
    if (openingDate.equals(todayMerchant)) {
      dateStr = 'today';
    } else if (openingDate.equals(tomorrowMerchant)) {
      dateStr = 'tomorrow';
    } else {
      dateStr = startTime.toFormat('EEE, MMM d');
    }
    
    const duration = parsed.duration || merchant.default_opening_duration || 30;
    const durationStr = duration === 60 ? '1 hr' : duration > 60 ? `${duration / 60} hrs` : `${duration} min`;
    
    const appointmentType = parsed.appointmentName ? ` - ${parsed.appointmentName}` : '';
    const confirmationMsg = `${merchant.business_name}: Opening added for ${dateStr} at ${timeStr} (${durationStr})${appointmentType}`;
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
      // Pass through friendly, known user-facing errors (conflicts, clarification, registration)
      const passThroughPatterns = /(already booked|already taken|time slot|choose a different time|not registered|clarify|what time|did you mean)/i;
      const userMsg = passThroughPatterns.test(errorMessage)
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

  const savedNames = merchant.saved_appointment_names || [];
  const systemPrompt = `You are a scheduling command parser for ${merchant.business_name}. Parse SMS messages to extract appointment details.

Merchant context:
- Business: ${merchant.business_name}
- Time zone: ${merchant.time_zone}
- Saved appointment types: ${savedNames.length > 0 ? savedNames.join(', ') : 'None'}
- Common durations: ${merchant.saved_durations?.join(', ') || '30'} minutes
- Default duration: ${merchant.default_opening_duration || 30} minutes
- Working hours: ${JSON.stringify(merchant.working_hours)}

Current date/time: ${new Date().toLocaleString('en-US', { timeZone: merchant.time_zone })}

CRITICAL RULES:
1. ONLY parse commands - do NOT refuse or validate appointment names
2. Smart-match appointment names: if user says "haircut", "hair cut", "Haircut", or similar → use exact saved name "Haircut" if it exists
3. If appointment name is close but not exact match (e.g., "straightening" vs saved "Keratin Treatment"), set needsClarification=true and ask: "Did you mean [saved name]?"
4. If appointment name is completely new and not similar to saved names, accept it as-is
5. If time is missing, set needsClarification=true and ask for time only
6. If date is unclear, assume today
7. Accept all commands as-is - merchants know their business

Return ONLY valid JSON:
{
  "date": "YYYY-MM-DD",
  "time": "HH:MM (24-hour)",
  "duration": number (minutes),
  "appointmentName": "string or null (use exact saved name if matched, otherwise as-is)",
  "staffName": "string or null",
  "confidence": "high|medium|low",
  "needsClarification": boolean,
  "clarificationQuestion": "string or null",
  "suggestedAppointmentName": "string or null (only if asking for clarification about name)"
}

Examples:
- "1pm haircut" + saved ["Haircut"] → appointmentName: "Haircut" (exact match)
- "straightening 2pm" + saved ["Keratin Treatment"] → needsClarification: true, clarificationQuestion: "Did you mean Keratin Treatment?", suggestedAppointmentName: "Keratin Treatment"
- "massage 3pm" + saved ["Haircut"] → appointmentName: "massage" (no match, accept as-is)
- "add opening" → needsClarification: true, clarificationQuestion: "What time?"
- "Add 2pm" → appointmentName: null (no service mentioned, accept as-is)`;

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
  const merchantTz = merchant.time_zone || 'America/New_York';
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

  // Extract date: today, tomorrow, or weekday - use merchant timezone
  const nowMerchant = DateTime.now().setZone(merchantTz);
  const todayMerchant = nowMerchant.startOf('day');
  
  if (msg.includes('tomorrow')) {
    const tomorrow = todayMerchant.plus({ days: 1 });
    result.date = tomorrow.toISODate() || '';
  } else if (msg.includes('monday') || msg.includes('mon')) {
    result.date = getNextWeekday(1, todayMerchant);
  } else if (msg.includes('tuesday') || msg.includes('tue')) {
    result.date = getNextWeekday(2, todayMerchant);
  } else if (msg.includes('wednesday') || msg.includes('wed')) {
    result.date = getNextWeekday(3, todayMerchant);
  } else if (msg.includes('thursday') || msg.includes('thu')) {
    result.date = getNextWeekday(4, todayMerchant);
  } else if (msg.includes('friday') || msg.includes('fri')) {
    result.date = getNextWeekday(5, todayMerchant);
  } else if (msg.includes('saturday') || msg.includes('sat')) {
    result.date = getNextWeekday(6, todayMerchant);
  } else if (msg.includes('sunday') || msg.includes('sun')) {
    result.date = getNextWeekday(7, todayMerchant);
  } else {
    // Default to today in merchant timezone
    result.date = todayMerchant.toISODate() || '';
  }

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

function getNextWeekday(targetDay: number, fromDate: DateTime): string {
  // Luxon uses 1-7 for Mon-Sun
  const luxonTargetDay = targetDay;
  const currentDay = fromDate.weekday;
  
  let daysToAdd = luxonTargetDay - currentDay;
  
  // If target day has passed this week, go to next week
  if (daysToAdd <= 0) {
    daysToAdd += 7;
  }
  
  const result = fromDate.plus({ days: daysToAdd });
  return result.toISODate() || '';
}

async function createOpening(supabase: any, merchant: any, parsed: OpeningRequest) {
  console.log('Creating opening with parsed data:', JSON.stringify(parsed, null, 2));

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
    
    if (staff) {
      staffId = staff.id;
    }
  }

  const duration = parsed.duration || merchant.default_opening_duration || 30;
  
  // Use Luxon for proper timezone conversion
  const merchantTz = merchant.time_zone || 'America/New_York';
  const localDateTime = DateTime.fromISO(`${parsed.date}T${parsed.time}`, { zone: merchantTz });
  
  // Convert to UTC and zero out seconds/milliseconds
  const startTimeUtc = localDateTime.toUTC().startOf('minute').toISO() || '';
  const endTimeUtc = localDateTime.plus({ minutes: duration }).toUTC().startOf('minute').toISO() || '';
  
  console.log(`[TZ] Merchant: ${merchantTz} | Local: ${parsed.date}T${parsed.time} | UTC Start: ${startTimeUtc} | UTC End: ${endTimeUtc}`);
  
  // Sanity check: ensure seconds are 00
  if (startTimeUtc && !startTimeUtc.includes(':00.000Z')) {
    console.warn(`[TZ WARNING] Start time has non-zero seconds/millis: ${startTimeUtc}`);
  }
  
  // Check for conflicts
  const { data: conflictCheck } = await supabase
    .rpc('check_slot_conflict', {
      p_merchant_id: merchant.id,
      p_staff_id: staffId,
      p_start_time: startTimeUtc,
      p_end_time: endTimeUtc,
      p_slot_id: null
    });

  if (conflictCheck) {
    // Fetch the conflicting slot details
    const { data: conflictingSlot } = await supabase
      .from('slots')
      .select('appointment_name, duration_minutes, status, staff_id')
      .eq('merchant_id', merchant.id)
      .eq('start_time', startTimeUtc)
      .single();

    // Build descriptive conflict message
    const conflictTime = localDateTime.toFormat('h:mm a');
    const conflictDate = localDateTime.toFormat('EEE, MMM d');
    
    let conflictDetails = '';
    if (conflictingSlot) {
      const appointmentType = conflictingSlot.appointment_name || 'an opening';
      const duration = conflictingSlot.duration_minutes;
      const durationStr = duration === 60 ? '1 hr' : duration > 60 ? `${duration / 60} hrs` : `${duration} min`;
      conflictDetails = ` You already have ${appointmentType} scheduled for ${durationStr}`;
    }
    
    const conflictMsg = `${merchant.business_name}: ${conflictDate} at ${conflictTime} is already booked.${conflictDetails}. Please choose a different time.`;
    console.warn('Conflict detected:', conflictMsg);
    throw new Error(conflictMsg);
  }

  // Insert the opening
  const { data: opening, error } = await supabase
    .from('slots')
    .insert({
      merchant_id: merchant.id,
      staff_id: staffId,
      start_time: startTimeUtc,
      end_time: endTimeUtc,
      duration_minutes: duration,
      appointment_name: parsed.appointmentName,
      status: 'open',
      created_via: 'sms'
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating opening:', error);
    throw error;
  }

  console.log('Opening created successfully:', opening.id);
  
  return opening;
}

async function handleUndo(supabase: any, merchantId: string, merchant: any, fromNumber: string) {
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

  // Send industry-standard deletion confirmation using merchant timezone
  const merchantTz = merchant.time_zone || 'America/New_York';
  const startTime = DateTime.fromISO(recentOpening.start_time, { zone: 'utc' }).setZone(merchantTz);
  const timeStr = startTime.toFormat('h:mm a');
  const dateStr = startTime.toFormat('MMM d');
  
  const appointmentType = recentOpening.appointment_name ? ` - ${recentOpening.appointment_name}` : '';
  const confirmMsg = `${merchant.business_name}: Deleted opening for ${dateStr} at ${timeStr}${appointmentType}`;
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

  // Compute target times - do NOT check for existing duplicates, always create new openings
  const merchantTz = merchant.time_zone || 'America/New_York';
  const duration = parsed.duration || merchant.default_opening_duration || 30;
  const localDateTime = DateTime.fromISO(`${parsed.date}T${parsed.time}`, { zone: merchantTz });
  const startTimeUtc = localDateTime.toUTC().startOf('minute').toISO() || '';
  const endTimeUtc = localDateTime.plus({ minutes: duration }).toUTC().startOf('minute').toISO() || '';

  // Create the opening (conflict detection now allows multiple unassigned slots)
  const opening = await createOpening(supabase, merchant, { ...parsed, duration });

  // Mark state as resolved
  await supabase
    .from('sms_intake_state')
    .update({ state: 'resolved' })
    .eq('id', state.id);

  // Send confirmation with industry-standard formatting using merchant timezone
  const timeStr = localDateTime.toFormat('h:mm a');

  const nowMerchant = DateTime.now().setZone(merchantTz);
  const todayMerchant = nowMerchant.startOf('day');
  const tomorrowMerchant = todayMerchant.plus({ days: 1 });
  const openingDate = DateTime.fromISO(parsed.date || '', { zone: merchantTz }).startOf('day');

  let dateStr;
  if (openingDate.equals(todayMerchant)) {
    dateStr = 'today';
  } else if (openingDate.equals(tomorrowMerchant)) {
    dateStr = 'tomorrow';
  } else {
    dateStr = localDateTime.toFormat('EEE, MMM d');
  }

  const durationStr = duration === 60 ? '1 hr' : duration > 60 ? `${duration / 60} hrs` : `${duration} min`;
  const appointmentType = parsed.appointmentName ? ` - ${parsed.appointmentName}` : '';
  const confirmationMsg = `${merchant.business_name}: Opening added for ${dateStr} at ${timeStr} (${durationStr})${appointmentType}`;
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
