import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DateTime } from "https://esm.sh/luxon@3.4.4";
import { parseSetmoreEmail, ParsedCancellation as SetmoreParsed } from "./providers/setmore.ts";
import { parseBooksyEmail, ParsedCancellation as BooksyParsed } from "./providers/booksy.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAiApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SupabaseClient = ReturnType<typeof createClient>;

type ParsedCancellation = {
  startTimeUtc: string;
  endTimeUtc: string;
  appointmentName?: string | null;
  confidence: number;
  provider?: string | null;
  source?: string | null;
  durationMinutes?: number | null;
  durationSource?: string | null;
};

type EmailPayload = {
  From?: string;
  To?: string;
  OriginalRecipient?: string;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  MessageID?: string;
  Date?: string;
  Attachments?: Array<{
    Name?: string;
    ContentType?: string;
    Content?: string;
  }>;
};

const PROVIDER_MAP: Record<string, string> = {
  booksy: 'booksy',
  setmore: 'setmore',
  square: 'square',
  vagaro: 'vagaro',
  fresha: 'fresha',
  acuity: 'acuity',
  glossgenius: 'glossgenius',
  schedulicity: 'schedulicity',
  mangomint: 'mangomint',
};

const VERIFICATION_SUBJECT_MATCHERS = [
  'forwarding confirmation',
  'gmail forwarding confirmation',
  'verify your forwarding',
  'confirm forwarding',
];

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as EmailPayload;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const toAddress = payload.OriginalRecipient || payload.To || '';
    const token = extractInboundToken(toAddress);

    if (!token) {
      return new Response(JSON.stringify({ success: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: merchant, error: merchantError } = await supabase
      .from('profiles')
      .select('id, phone, time_zone, default_opening_duration, auto_openings_enabled, use_booking_system, default_location_id')
      .eq('inbound_email_token', token)
      .maybeSingle();

    if (merchantError || !merchant) {
      console.error('[inbound-email] Merchant lookup failed:', merchantError);
      return new Response(JSON.stringify({ success: false, error: 'merchant_not_found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const locationId = await resolveLocationId(supabase, merchant.id, merchant.default_location_id);

    const fromAddress = payload.From || '';
    const subject = payload.Subject || '';
    const rawText = payload.TextBody || '';
    const rawHtml = payload.HtmlBody || '';
    const textForParse = rawText || stripHtml(rawHtml);
    const combinedText = `${subject} ${textForParse}`.trim();
    const messageId = payload.MessageID || null;
    const receivedAt = payload.Date || null;
    const baseDate = receivedAt
      ? DateTime.fromRFC2822(receivedAt).isValid
        ? DateTime.fromRFC2822(receivedAt)
        : DateTime.fromISO(receivedAt)
      : null;

    const provider = detectProvider(fromAddress, subject, textForParse);

    const isVerification = isForwardingVerification(subject, textForParse);
    const verificationUrl = isVerification ? extractFirstUrl(textForParse) : null;

    const eventType = isVerification ? 'forwarding_verification' : 'email_received';

    await supabase
      .from('email_inbound_events')
      .insert({
        merchant_id: merchant.id,
        location_id: locationId,
        message_id: messageId,
        from_address: fromAddress,
        to_address: toAddress,
        subject,
        provider,
        event_type: eventType,
        raw_text: rawText,
        raw_html: rawHtml,
        parsed_data: verificationUrl ? { verification_url: verificationUrl } : null,
        received_at: receivedAt,
      })
      .select();

    if (isVerification) {
      await supabase
        .from('profiles')
        .update({ inbound_email_status: 'verification_received' })
        .eq('id', merchant.id);

      return new Response(JSON.stringify({ success: true, verification_received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase
      .from('profiles')
      .update({ inbound_email_last_received_at: new Date().toISOString(), inbound_email_status: 'active' })
      .eq('id', merchant.id);

    if (!merchant.auto_openings_enabled || !merchant.use_booking_system) {
      return new Response(JSON.stringify({ success: true, disabled: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isReschedule = looksLikeReschedule(subject, textForParse);
    if (!looksLikeCancellation(subject, combinedText) && !isReschedule) {
      await supabase
        .from('email_inbound_events')
        .update({ event_type: 'email_ignored_non_cancellation' })
        .eq('message_id', messageId);

      return new Response(JSON.stringify({ success: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const defaultDuration = normalizeDuration(merchant.default_opening_duration);
    const timeRange = extractTimeRange(combinedText);
    const timeText = timeRange?.start || extractTime(combinedText);
    const explicitDate = extractDate(combinedText);
    const relativeWeekday = extractRelativeWeekday(combinedText, merchant.time_zone || 'America/New_York', baseDate);
    const relativeDay = extractRelativeDay(combinedText, merchant.time_zone || 'America/New_York', baseDate);
    const hasSpecificDate = !!explicitDate || !!relativeWeekday || (relativeDay && !isAmbiguousRelative(combinedText));
    const hasTime = !!timeText;

    if (!hasSpecificDate || !hasTime) {
      await supabase
        .from('email_inbound_events')
        .update({
          event_type: 'cancellation_unparsed',
          confidence: 0.1,
          parsed_data: { missing_date: !hasSpecificDate, missing_time: !hasTime },
        })
        .eq('message_id', messageId);

      if (merchant.phone) {
        await sendSms(
          merchant.phone,
          "We received a cancellation but couldn't read the details. Please check your booking platform and create the opening manually."
        );
      }

      return new Response(JSON.stringify({ success: false, error: 'missing_date_or_time' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let parsed: (SetmoreParsed | BooksyParsed)[] | null = null;
    if (provider === 'setmore') {
      parsed = parseSetmoreEmail({
        subject,
        html: rawHtml,
        text: textForParse,
        attachments: payload.Attachments,
        merchantTimeZone: merchant.time_zone || 'America/New_York',
        defaultDuration,
        baseDate,
      });
    }
    if (!parsed && provider === 'booksy') {
      parsed = parseBooksyEmail({
        subject,
        html: rawHtml,
        text: textForParse,
        merchantTimeZone: merchant.time_zone || 'America/New_York',
        defaultDuration,
      });
    }

    if (!parsed) {
      parsed = await parseCancellations({
        subject,
        text: combinedText,
        provider,
        merchantTimeZone: merchant.time_zone || 'America/New_York',
        defaultDuration,
        baseDate,
      });
    }

    if (!parsed || parsed.length === 0 || parsed.length > 1) {
      await supabase
        .from('email_inbound_events')
        .update({ event_type: 'cancellation_unparsed', confidence: 0.1 })
        .eq('message_id', messageId);

      if (merchant.phone) {
        await sendSms(
          merchant.phone,
          "We received a cancellation but couldn't read the details. Please check your booking platform and create the opening manually."
        );
      }

      const errorReason = !parsed || parsed.length === 0 ? 'unable_to_parse' : 'multiple_candidates';
      return new Response(JSON.stringify({ success: false, error: errorReason }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase
      .from('email_inbound_events')
      .update({
        event_type: 'cancellation_parsed',
        parsed_data: parsed.map((entry) => ({
          start_time_utc: entry.startTimeUtc,
          end_time_utc: entry.endTimeUtc,
          appointment_name: entry.appointmentName || null,
          source: entry.source || null,
          duration_minutes: entry.durationMinutes || null,
          duration_source: entry.durationSource || null,
        })),
        confidence: 1,
      })
      .eq('message_id', messageId);

    const entry = parsed[0];
    const opening = await createOpening(supabase, merchant.id, entry, locationId);

    return new Response(JSON.stringify({
      success: true,
      opening_ids: opening ? [opening.id] : [],
      confirmation_required: false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[inbound-email] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function extractInboundToken(address: string): string | null {
  const match = address.match(/notify\+([0-9a-fA-F-]{36})@/);
  return match?.[1] || null;
}

async function resolveLocationId(
  supabase: SupabaseClient,
  merchantId: string,
  defaultLocationId?: string | null
): Promise<string | null> {
  if (defaultLocationId) return defaultLocationId;

  const { data: location } = await supabase
    .from('locations')
    .select('id')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return location?.id ?? null;
}

function detectProvider(fromAddress: string, subject: string, text: string): string | null {
  const haystack = `${fromAddress} ${subject} ${text}`.toLowerCase();
  const providerKey = Object.keys(PROVIDER_MAP).find((key) => haystack.includes(key));
  return providerKey ? PROVIDER_MAP[providerKey] : null;
}

function isForwardingVerification(subject: string, text: string): boolean {
  const haystack = `${subject} ${text}`.toLowerCase();
  return VERIFICATION_SUBJECT_MATCHERS.some((matcher) => haystack.includes(matcher));
}

function looksLikeCancellation(subject: string, text: string): boolean {
  const haystack = `${subject} ${text}`.toLowerCase();
  return (
    haystack.includes('cancel') ||
    haystack.includes('cancellation') ||
    haystack.includes('canceled') ||
    haystack.includes('cancelled') ||
    haystack.includes('cancelado') ||
    haystack.includes('cancelada') ||
    haystack.includes('cancelación') ||
    haystack.includes('annulé') ||
    haystack.includes('annulée') ||
    haystack.includes('annulation')
  );
}

function looksLikeReschedule(subject: string, text: string): boolean {
  const haystack = `${subject} ${text}`.toLowerCase();
  return (
    haystack.includes('reschedule') ||
    haystack.includes('rescheduled') ||
    haystack.includes('rescheduling') ||
    haystack.includes('changed') ||
    haystack.includes('moved')
  );
}

function normalizeDuration(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? parsed : 30;
}

function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s>]+/i);
  return match?.[0] || null;
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function parseCancellations(input: {
  subject: string;
  text: string;
  provider: string | null;
  merchantTimeZone: string;
  defaultDuration: number;
  baseDate: DateTime | null;
}): Promise<ParsedCancellation[]> {
  const { subject, text, provider, merchantTimeZone, defaultDuration, baseDate } = input;

  const timeRange = extractTimeRange(text);
  const dateText = extractDate(text);
  const relativeDay = extractRelativeDay(text, merchantTimeZone, baseDate);
  const relativeDate = extractRelativeWeekday(text, merchantTimeZone, baseDate) || relativeDay?.date || null;
  const timeText = timeRange?.start || extractTime(text);
  const multipleAppointments = hasMultipleAppointments(text);
  const extractedDuration = extractDurationMinutes(text);
  const durationOverride = extractedDuration || defaultDuration;
  const durationSource = timeRange?.end
    ? 'range'
    : extractedDuration
      ? 'explicit'
      : 'default';
  const reschedule = extractRescheduleTimes(text, merchantTimeZone, durationOverride, baseDate);
  const confidenceInput = {
    hasExplicitDate: !!dateText,
    hasRelativeDate: !!relativeDate,
    hasExplicitTime: !!timeText,
    hasTimeRange: !!timeRange?.end,
    hasTimezone: hasExplicitTimezone(text),
    multipleAppointments,
    isReschedule: !!reschedule,
    fromAi: false,
  };

  if (reschedule?.oldStart) {
    return [{
      startTimeUtc: reschedule.oldStart.toUTC().startOf('minute').toISO() || '',
      endTimeUtc: reschedule.oldEnd.toUTC().startOf('minute').toISO() || '',
      appointmentName: extractServiceName(text),
      confidence: computeConfidence({ ...confidenceInput, isReschedule: true }),
      provider,
      source: 'reschedule_old',
      durationMinutes: durationOverride,
      durationSource,
    }];
  }

  const candidates = extractDateTimeCandidates(text, merchantTimeZone, durationOverride, baseDate);
  if (candidates.length > 0) {
    return candidates.map((candidate) => {
      const startUtc = candidate.start.toUTC().startOf('minute');
      const endUtc = durationSource === 'range'
        ? candidate.end.toUTC().startOf('minute')
        : startUtc.plus({ minutes: durationOverride });

      return {
        startTimeUtc: startUtc.toISO() || '',
        endTimeUtc: endUtc.toISO() || '',
        appointmentName: extractServiceName(text),
        confidence: computeConfidence({
          ...confidenceInput,
          hasExplicitDate: candidate.source === 'explicit' || confidenceInput.hasExplicitDate,
          hasRelativeDate: candidate.source !== 'explicit' && confidenceInput.hasRelativeDate,
          hasTimeRange: candidate.source === 'explicit' ? confidenceInput.hasTimeRange : confidenceInput.hasTimeRange,
        }),
        provider,
        source: candidate.source,
        durationMinutes: durationOverride,
        durationSource,
      };
    });
  }

  if (openAiApiKey) {
    const aiParsed = await parseWithOpenAi({
      subject,
      text,
      merchantTimeZone,
      defaultDuration: durationOverride,
      durationSource,
      hasExplicitRange: !!timeRange?.end,
      relativeDate,
      hasExplicitDate: !!dateText,
      baseDate,
      confidenceInput: {
        ...confidenceInput,
        fromAi: true,
      },
    });
    return aiParsed ? [aiParsed] : [];
  }

  return [];
}

function extractDate(text: string): string | null {
  const isoMatch = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (isoMatch) return isoMatch[0];

  const usMatch = text.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/);
  if (usMatch) return usMatch[0];

  const longMatch = text.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?\.?[,]?\s*(Jan(?:uary)?\.?|Feb(?:ruary)?\.?|Mar(?:ch)?\.?|Apr(?:il)?\.?|May\.?|Jun(?:e)?\.?|Jul(?:y)?\.?|Aug(?:ust)?\.?|Sep(?:tember)?\.?|Sept(?:ember)?\.?|Oct(?:ober)?\.?|Nov(?:ember)?\.?|Dec(?:ember)?\.?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?/i);
  if (longMatch) return longMatch[0];

  return null;
}

function extractTime(text: string): string | null {
  const timeMatch = text.match(/\b(\d{1,2}(?::\d{2})?\s*(AM|PM|A\.?M\.?|P\.?M\.?)|([01]?\d|2[0-3]):[0-5]\d)(?:\s*(ET|EST|EDT|CT|CST|CDT|MT|MST|MDT|PT|PST|PDT))?\b/i);
  return timeMatch ? timeMatch[0] : null;
}

function extractTimeRange(text: string): { start: string; end: string } | null {
  const rangeMatch = text.match(
    /\b(\d{1,2}(?::\d{2})?\s*(?:AM|PM|A\.?M\.?|P\.?M\.?)|([01]?\d|2[0-3]):[0-5]\d)(?:\s*(ET|EST|EDT|CT|CST|CDT|MT|MST|MDT|PT|PST|PDT))?\s*(?:-|to|–)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|A\.?M\.?|P\.?M\.?)|([01]?\d|2[0-3]):[0-5]\d)(?:\s*(ET|EST|EDT|CT|CST|CDT|MT|MST|MDT|PT|PST|PDT))?\b/i
  );
  if (!rangeMatch) return null;
  return { start: `${rangeMatch[1]} ${rangeMatch[3] || ''}`.trim(), end: `${rangeMatch[4]} ${rangeMatch[6] || ''}`.trim() };
}

function extractDurationMinutes(text: string): number | null {
  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs)\b/i);
  if (hourMatch) {
    const hours = parseFloat(hourMatch[1]);
    return Math.round(hours * 60);
  }

  const minuteMatch = text.match(/(\d{1,3})\s*(minute|minutes|min|mins)\b/i);
  if (minuteMatch) {
    return parseInt(minuteMatch[1], 10);
  }

  return null;
}

function extractRelativeWeekday(text: string, zone: string, baseDate: DateTime | null): DateTime | null {
  const match = text.match(/\b(next\s+)?(mon|tue|wed|thu|fri|sat|sun)(day)?\b/i);
  if (!match) return null;

  const hasNext = !!match[1];
  const weekday = match[2].toLowerCase();
  const weekdayMap: Record<string, number> = {
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
    sun: 7,
  };

  const target = weekdayMap[weekday];
  const now = (baseDate || DateTime.now()).setZone(zone).startOf('day');
  const daysUntil = (target + 7 - now.weekday) % 7;
  const offset = hasNext ? (daysUntil === 0 ? 7 : daysUntil + 7) : (daysUntil === 0 ? 7 : daysUntil);

  return now.plus({ days: offset });
}

function parseTimeParts(timeText: string): { hour: number; minute: number } {
  const cleaned = stripTimezone(timeText);
  const meridiemMatch = cleaned.match(/(\d{1,2})(?::(\d{2}))?\s*(A\.?M\.?|P\.?M\.?|AM|PM)/i);
  if (!meridiemMatch) {
    const match24 = cleaned.match(/([01]?\d|2[0-3]):([0-5]\d)/);
    if (match24) {
      return { hour: parseInt(match24[1], 10), minute: parseInt(match24[2], 10) };
    }
    return { hour: 9, minute: 0 };
  }

  let hour = parseInt(meridiemMatch[1], 10);
  const minute = meridiemMatch[2] ? parseInt(meridiemMatch[2], 10) : 0;
  const meridiem = meridiemMatch[3].toUpperCase().replace(/\./g, '');

  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;

  return { hour, minute };
}

function extractRelativeDay(text: string, zone: string, baseDate: DateTime | null): { date: DateTime; confidence: number } | null {
  const normalized = text.toLowerCase();
  const now = (baseDate || DateTime.now()).setZone(zone).startOf('day');

  if (normalized.includes('tomorrow') || normalized.includes('mañana') || normalized.includes('demain')) {
    return { date: now.plus({ days: 1 }), confidence: 0.85 };
  }

  if (normalized.includes('today') || normalized.includes('hoy') || normalized.includes("aujourd'hui")) {
    return { date: now, confidence: 0.85 };
  }

  if (normalized.includes('next week') || normalized.includes('próxima semana') || normalized.includes('prochaine semaine')) {
    return { date: now.plus({ days: 7 }), confidence: 0.6 };
  }

  return null;
}

function isAmbiguousRelative(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('next week') ||
    normalized.includes('próxima semana') ||
    normalized.includes('prochaine semaine')
  );
}

function hasExplicitTimezone(text: string): boolean {
  return /\b(ET|EST|EDT|CT|CST|CDT|MT|MST|MDT|PT|PST|PDT)\b/i.test(text);
}

function hasMultipleAppointments(text: string): boolean {
  const matches = text.match(/\b(appointment|appointments|booking|bookings)\b/gi);
  if (matches && matches.length > 1) return true;
  const timeRange = extractTimeRange(text);
  const timeMatches = [...text.matchAll(/\b(\d{1,2}(?::\d{2})?\s*(AM|PM)|([01]?\d|2[0-3]):[0-5]\d)\b/gi)];
  if (timeRange) {
    if (timeMatches.length > 2) return true;
    const dateMatches = [...text.matchAll(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?\.?[,]?\s*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Sept(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,?\s+\d{4})?\b/gi)];
    return dateMatches.length > 1;
  }
  return timeMatches.length > 1;
}

function resolveTimezoneOverride(text: string): string | null {
  const match = text.match(/\b(ET|EST|EDT|CT|CST|CDT|MT|MST|MDT|PT|PST|PDT)\b/i);
  if (!match) return null;

  const map: Record<string, string> = {
    ET: 'America/New_York',
    EST: 'America/New_York',
    EDT: 'America/New_York',
    CT: 'America/Chicago',
    CST: 'America/Chicago',
    CDT: 'America/Chicago',
    MT: 'America/Denver',
    MST: 'America/Denver',
    MDT: 'America/Denver',
    PT: 'America/Los_Angeles',
    PST: 'America/Los_Angeles',
    PDT: 'America/Los_Angeles',
  };

  return map[match[1].toUpperCase()] || null;
}

function stripTimezone(text: string): string {
  return text.replace(/\b(ET|EST|EDT|CT|CST|CDT|MT|MST|MDT|PT|PST|PDT)\b/gi, '').trim();
}

function extractRescheduleTimes(text: string, zone: string, durationMinutes: number, baseDate: DateTime | null): { oldStart: DateTime; oldEnd: DateTime } | null {
  const match = text.match(/\b(changed|rescheduled|moved)\s+from\s+(.+?)\s+to\s+(.+?)(?:\.|$)/i);
  if (!match) return null;

  const oldText = match[2];
  const oldDate = extractDate(oldText) || extractDate(text);
  const oldTime = extractTime(oldText);
  const oldRel = extractRelativeWeekday(oldText, zone, baseDate) || extractRelativeDay(oldText, zone, baseDate)?.date;

  if ((!oldDate && !oldRel) || !oldTime) return null;

  const oldStart = oldDate
    ? parseDateTime(oldDate, oldTime, zone)
    : oldRel?.set(parseTimeParts(oldTime));

  if (!oldStart) return null;

  return {
    oldStart,
    oldEnd: oldStart.plus({ minutes: durationMinutes }),
  };
}

function extractDateTimeCandidates(
  text: string,
  zone: string,
  durationMinutes: number,
  baseDate: DateTime | null
): Array<{ start: DateTime; end: DateTime; confidence: number; source: string }> {
  const results: Array<{ start: DateTime; end: DateTime; confidence: number; source: string }> = [];

  const dateMatches = [...text.matchAll(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?\.?[,]?\s*(Jan(?:uary)?\.?|Feb(?:ruary)?\.?|Mar(?:ch)?\.?|Apr(?:il)?\.?|May\.?|Jun(?:e)?\.?|Jul(?:y)?\.?|Aug(?:ust)?\.?|Sep(?:tember)?\.?|Sept(?:ember)?\.?|Oct(?:ober)?\.?|Nov(?:ember)?\.?|Dec(?:ember)?\.?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/gi)];
  const timeMatches = [...text.matchAll(/\b(\d{1,2}(?::\d{2})?\s*(AM|PM)|([01]?\d|2[0-3]):[0-5]\d)(?:\s*(ET|EST|EDT|CT|CST|CDT|MT|MST|MDT|PT|PST|PDT))?\b/gi)];

  for (const dateMatch of dateMatches) {
    const dateText = dateMatch[0];
    const timeMatch = timeMatches.find((match) => Math.abs(match.index! - dateMatch.index!) < 50);
    if (!timeMatch) continue;

    const startLocal = parseDateTime(dateText, timeMatch[0], zone);
    if (!startLocal) continue;
    const endLocal = startLocal.plus({ minutes: durationMinutes });

    results.push({
      start: startLocal,
      end: endLocal,
      confidence: 0.85,
      source: 'explicit',
    });
  }

  const relative = extractRelativeDay(text, zone, baseDate);
  const timeText = extractTime(text);
  if (relative && timeText) {
    const startLocal = relative.date.set(parseTimeParts(timeText));
    results.push({
      start: startLocal,
      end: startLocal.plus({ minutes: durationMinutes }),
      confidence: relative.confidence,
      source: 'relative',
    });
  }

  const weekday = extractRelativeWeekday(text, zone, baseDate);
  if (weekday && timeText) {
    const startLocal = weekday.set(parseTimeParts(timeText));
    results.push({
      start: startLocal,
      end: startLocal.plus({ minutes: durationMinutes }),
      confidence: 0.7,
      source: 'weekday',
    });
  }

  return results;
}

function parseDateTime(dateText: string, timeText: string, zone: string): DateTime | null {
  const zoned = resolveTimezoneOverride(timeText) || zone;
  const normalizedTime = stripTimezone(timeText);
  const formats = [
    'yyyy-MM-dd h:mm a',
    'yyyy-MM-dd h a',
    'M/d/yyyy h:mm a',
    'M/d/yyyy h a',
    'M/d/yy h:mm a',
    'M/d/yy h a',
    'MMMM d, yyyy h:mm a',
    'MMM d, yyyy h:mm a',
    'MMMM d, yyyy h a',
    'MMM d, yyyy h a',
    'MMMM d h:mm a',
    'MMM d h:mm a',
    'MMMM d h a',
    'MMM d h a',
    'yyyy-MM-dd HH:mm',
    'M/d/yyyy HH:mm',
    'M/d/yy HH:mm',
    'MMMM d, yyyy HH:mm',
    'MMM d, yyyy HH:mm',
    'MMMM d HH:mm',
    'MMM d HH:mm',
  ];

  const cleanedDate = dateText.replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\.?[,]?\s*/i, '');
  const cleaned = `${cleanedDate} ${normalizedTime}`.replace(/\s+/g, ' ').trim();

  for (const format of formats) {
    const parsed = DateTime.fromFormat(cleaned, format, { zone: zoned });
    if (parsed.isValid) {
      return normalizeYear(parsed);
    }
  }

  return null;
}

function normalizeYear(dt: DateTime): DateTime {
  if (dt.year < 2000) {
    return dt.set({ year: DateTime.now().year });
  }

  if (dt < DateTime.now().minus({ days: 1 })) {
    return dt.plus({ years: 1 });
  }

  return dt;
}

function extractServiceName(text: string): string | null {
  const match = text.match(/(?:service|appointment)\s*:?\s*([A-Za-z0-9 &-]{3,40})/i);
  const candidate = match?.[1]?.trim() || '';
  if (!candidate) return null;

  const looksLikeTime = /\b(\d{1,2}(?::\d{2})?\s*(AM|PM)|([01]?\d|2[0-3]):[0-5]\d)\b/i.test(candidate);
  const looksLikeWeekday = /\b(mon|tue|wed|thu|fri|sat|sun|today|tomorrow|next week)\b/i.test(candidate);
  if (looksLikeTime || looksLikeWeekday) return null;

  return candidate;
}

async function parseWithOpenAi(input: {
  subject: string;
  text: string;
  merchantTimeZone: string;
  defaultDuration: number;
  durationSource: string;
  hasExplicitRange: boolean;
  relativeDate: DateTime | null;
  hasExplicitDate: boolean;
  baseDate: DateTime | null;
  confidenceInput: ConfidenceInput;
}): Promise<ParsedCancellation | null> {
  if (!openAiApiKey) return null;

  const baseDateHint = input.baseDate ? `Assume today's date is ${input.baseDate.setZone(input.merchantTimeZone).toISODate()} in ${input.merchantTimeZone}.` : '';
  const prompt = `You are extracting cancellation details from booking emails.\n\nReturn a JSON object ONLY (no code fences) with:\n- start_time (ISO 8601 in merchant timezone: ${input.merchantTimeZone})\n- end_time (ISO 8601 in merchant timezone)\n- appointment_name (string or null)\n- confidence (0 to 1)\n\n${baseDateHint}\nIf the email uses relative time like "next Friday", resolve it to the next occurrence in the future. If any guesswork is required, keep confidence below 0.7.\n\nEmail subject: ${input.subject}\nEmail body: ${input.text}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    console.error('[inbound-email] OpenAI error', await response.text());
    return null;
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    const cleaned = content
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    const resolvedZone = resolveTimezoneOverride(parsed.start_time) || input.merchantTimeZone;
    let startLocal = DateTime.fromISO(stripTimezone(parsed.start_time), { zone: resolvedZone });
    let endLocal = parsed.end_time && input.hasExplicitRange
      ? DateTime.fromISO(stripTimezone(parsed.end_time), { zone: resolvedZone })
      : startLocal.plus({ minutes: input.defaultDuration });
    if (!startLocal.isValid) return null;
    if (!endLocal.isValid) {
      endLocal = startLocal.plus({ minutes: input.defaultDuration });
    }

    const now = DateTime.now().setZone(input.merchantTimeZone);
    if (input.relativeDate) {
      const inferred = input.relativeDate.set({ hour: startLocal.hour, minute: startLocal.minute });
      if (inferred.isValid) {
        startLocal = inferred;
        if (!endLocal.isValid || endLocal <= startLocal) {
          endLocal = startLocal.plus({ minutes: input.defaultDuration });
        }
      }
    }

    if (!input.hasExplicitDate && startLocal < now.minus({ days: 1 })) {
      startLocal = startLocal.plus({ years: 1 });
      endLocal = endLocal.plus({ years: 1 });
    }

    if (endLocal <= startLocal) {
      endLocal = startLocal.plus({ minutes: input.defaultDuration });
    }

    const durationSource = input.durationSource === 'range' && input.hasExplicitRange
      ? 'range'
      : input.durationSource === 'explicit'
        ? 'explicit'
        : 'default';
    const durationMinutes = durationSource === 'range'
      ? Math.max(5, Math.round(endLocal.diff(startLocal, 'minutes').minutes))
      : input.defaultDuration;
    if (durationSource !== 'range') {
      endLocal = startLocal.plus({ minutes: durationMinutes });
    }

    let adjustedConfidence = computeConfidence({
      ...input.confidenceInput,
      hasExplicitDate: input.hasExplicitDate,
      hasRelativeDate: !!input.relativeDate,
      hasExplicitTime: true,
      hasTimeRange: input.hasExplicitRange,
      hasTimezone: hasExplicitTimezone(input.text),
      fromAi: true,
    });
    if (startLocal < now) adjustedConfidence = Math.min(adjustedConfidence, 0.4);

    return {
      startTimeUtc: startLocal.toUTC().startOf('minute').toISO() || '',
      endTimeUtc: endLocal.toUTC().startOf('minute').toISO() || '',
      appointmentName: parsed.appointment_name || null,
      confidence: adjustedConfidence,
      provider: null,
      durationMinutes,
      durationSource,
    };
  } catch (error) {
    console.error('[inbound-email] Failed to parse OpenAI JSON', error);
    return null;
  }
}

type ConfidenceInput = {
  hasExplicitDate: boolean;
  hasRelativeDate: boolean;
  hasExplicitTime: boolean;
  hasTimeRange: boolean;
  hasTimezone: boolean;
  multipleAppointments: boolean;
  isReschedule: boolean;
  fromAi: boolean;
};

function computeConfidence(input: ConfidenceInput): number {
  let score = 0;

  if (input.hasExplicitDate) score += 0.5;
  else if (input.hasRelativeDate) score += 0.5;

  if (input.hasTimeRange) score += 0.45;
  else if (input.hasExplicitTime) score += 0.35;

  if (input.hasTimezone) score += 0.05;

  if (input.multipleAppointments) score -= 0.2;
  if (input.isReschedule) score -= 0.05;
  if (!input.hasExplicitDate && !input.hasRelativeDate) score -= 0.4;
  if (!input.hasExplicitTime && !input.hasTimeRange) score -= 0.4;

  if (input.fromAi) score = Math.min(score, 0.75);

  return Math.max(0.1, Math.min(1, score));
}

async function createOpening(
  supabase: SupabaseClient,
  merchantId: string,
  parsed: ParsedCancellation,
  locationId: string | null
) {
  const { data: merchant } = await supabase
    .from('profiles')
    .select('id, time_zone, default_opening_duration')
    .eq('id', merchantId)
    .single();

  if (!merchant) {
    throw new Error('Merchant not found');
  }

  // Allow overlapping openings for future multi-chair support.

  const durationMinutes = normalizeDuration(parsed.durationMinutes ?? merchant.default_opening_duration);
  const startTime = DateTime.fromISO(parsed.startTimeUtc);
  const endTime = parsed.durationSource === 'range' && parsed.endTimeUtc
    ? DateTime.fromISO(parsed.endTimeUtc)
    : startTime.plus({ minutes: durationMinutes });

  const { data: opening, error } = await supabase
    .from('slots')
    .insert({
      merchant_id: merchantId,
      location_id: locationId,
      staff_id: null,
      start_time: startTime.toISO(),
      end_time: endTime.toISO(),
      duration_minutes: durationMinutes,
      appointment_name: parsed.appointmentName || null,
      status: 'open',
      created_via: 'email',
    })
    .select()
    .single();

  if (error) throw error;

  return opening;
}

async function sendSms(to: string, message: string) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  try {
    await supabase.functions.invoke('send-sms', { body: { to, message } });
  } catch (error) {
    console.error('[inbound-email] Failed to send SMS', error);
  }
}
