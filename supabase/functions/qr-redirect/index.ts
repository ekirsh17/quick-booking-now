import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const shortCode = url.pathname.split('/').pop();

    console.log('QR Redirect request for short code:', shortCode);

    if (!shortCode) {
      return new Response('Invalid QR code', { status: 400 });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Lookup QR code
    const { data: qrCode, error: qrError } = await supabaseClient
      .from('qr_codes')
      .select('id, merchant_id, is_active')
      .eq('short_code', shortCode)
      .eq('is_active', true)
      .single();

    if (qrError || !qrCode) {
      console.error('QR code not found:', shortCode, qrError);
      return new Response('QR Code not found', { status: 404 });
    }

    console.log('Found QR code for merchant:', qrCode.merchant_id);

    // Track scan (async, don't block redirect)
    const userAgent = req.headers.get('user-agent') || '';
    const deviceType = getDeviceType(userAgent);
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    
    // Insert scan record
    supabaseClient.from('qr_code_scans').insert({
      qr_code_id: qrCode.id,
      user_agent: userAgent,
      ip_address: ipAddress,
      referrer: req.headers.get('referer'),
      device_type: deviceType,
    }).then(({ error }) => {
      if (error) console.error('Error tracking scan:', error);
      else console.log('Scan tracked successfully');
    });

    // Update scan count
    supabaseClient.rpc('increment_qr_scan_count', { 
      qr_id: qrCode.id 
    }).then(({ error }) => {
      if (error) console.error('Error incrementing scan count:', error);
    });

    // Redirect to merchant notify page
    const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('/functions/v1', '') || '';
    const redirectUrl = `${baseUrl}/notify/${qrCode.merchant_id}`;
    
    console.log('Redirecting to:', redirectUrl);

    return new Response(null, {
      status: 302,
      headers: { 'Location': redirectUrl },
    });
  } catch (error) {
    console.error('Error in QR redirect:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
});

function getDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    return 'mobile';
  }
  if (/tablet|ipad/i.test(ua)) {
    return 'tablet';
  }
  return 'desktop';
}
