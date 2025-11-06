import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Method = 'GET' | 'POST' | 'OPTIONS';

interface RequestBody {
  messagingServiceSid?: string; // MG...
  campaignSid?: string;         // QE...
}

async function twilioFetch(path: string, init?: RequestInit) {
  const auth = 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const url = `https://messaging.twilio.com${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let data: any = undefined;
  try { data = text ? JSON.parse(text) : undefined; } catch (_) { /* keep text */ }
  if (!res.ok) {
    console.error('Twilio API error', res.status, text);
    throw new Error(data?.message || data?.error || text || `Twilio error ${res.status}`);
  }
  return data;
}

async function handleGetOrPost(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method as Method;

  let params: RequestBody = {};
  if (method === 'GET') {
    params.messagingServiceSid = url.searchParams.get('messagingServiceSid') || undefined;
    params.campaignSid = url.searchParams.get('campaignSid') || undefined;
  } else if (method === 'POST') {
    try { params = await req.json(); } catch (_) { params = {}; }
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return new Response(JSON.stringify({ success: false, error: 'Twilio credentials not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { messagingServiceSid, campaignSid } = params;

    // If both Messaging Service and Campaign SID are provided, fetch a single campaign
    if (messagingServiceSid && campaignSid) {
      console.log('Fetching single A2P Campaign status', { messagingServiceSid, campaignSid });
      const data = await twilioFetch(`/v1/Services/${messagingServiceSid}/Compliance/Usa2p/${campaignSid}`);
      return new Response(JSON.stringify({ success: true, type: 'campaign', data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If only Messaging Service SID is provided, list all campaigns for that service
    if (messagingServiceSid) {
      console.log('Listing A2P Campaigns for Messaging Service', messagingServiceSid);
      const list = await twilioFetch(`/v1/Services/${messagingServiceSid}/Compliance/Usa2p`);
      // Twilio list responses typically return { meta, data: [...] }
      const campaigns = Array.isArray(list?.data) ? list.data : list?.us_app_to_people || [];
      return new Response(JSON.stringify({ success: true, type: 'campaigns', campaigns }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback: list Brand Registrations for the account
    console.log('Listing Brand Registrations for account');
    const brands = await twilioFetch(`/v1/a2p/BrandRegistrations`);
    const data = Array.isArray(brands?.data) ? brands.data : [];

    return new Response(JSON.stringify({ success: true, type: 'brands', brands: data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return handleGetOrPost(req);
};

serve(handler);
