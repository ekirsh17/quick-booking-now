import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    console.log('Generate OTP request for phone:', phone);

    // Validate phone format (E.164: +[country][number])
    if (!phone || !phone.match(/^\+[1-9]\d{1,14}$/)) {
      throw new Error('Invalid phone number format. Please use international format (e.g., +1234567890)');
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Rate limiting: Check if OTP was requested recently (prevent spam)
    const { data: recentOtp } = await supabase
      .from('otp_codes')
      .select('created_at')
      .eq('phone', phone)
      .gte('created_at', new Date(Date.now() - 60 * 1000).toISOString())
      .maybeSingle();

    if (recentOtp) {
      console.log('Rate limit hit for phone:', phone);
      throw new Error('OTP already sent. Please wait 1 minute before requesting again.');
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    console.log('Generated OTP code, expires at:', expiresAt);

    // Store OTP in database
    const { error: dbError } = await supabase
      .from('otp_codes')
      .insert({
        phone,
        code,
        expires_at: expiresAt.toISOString(),
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

    console.log('OTP stored in database, sending SMS...');

    // Send OTP via Twilio using existing send-sms function
    const smsResponse = await supabase.functions.invoke('send-sms', {
      body: {
        to: phone,
        message: `Your NotifyMe verification code is: ${code}. Valid for 5 minutes.`,
      }
    });

    if (smsResponse.error) {
      console.error('SMS sending error:', smsResponse.error);
      throw new Error('Failed to send SMS: ' + smsResponse.error.message);
    }

    console.log('SMS sent successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'OTP sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Generate OTP error:', error);
    
    // Determine if this is a user error (validation, rate limit) or server error
    const isUserError = error.message.includes('OTP already sent') || 
                        error.message.includes('Invalid phone number');
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: isUserError ? 200 : 500,  // Return 200 for user errors, 500 for server errors
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
