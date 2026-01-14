import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhoneToE164 } from "../shared/phoneNormalization.ts";

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

    // Normalize phone to E.164 format using centralized utility
    let normalized: string;
    try {
      normalized = normalizePhoneToE164(phone);
      console.log('Normalized phone to E.164 format:', normalized.substring(0, 5) + '***');
    } catch (normalizationError: any) {
      console.error('Phone normalization error:', normalizationError);
      throw new Error(`Invalid phone number format: ${normalizationError.message}. Please use international format (e.g., +12125551234)`);
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Rate limiting: Check if OTP was requested recently (prevent spam, use normalized phone)
    const { data: recentOtp } = await supabase
      .from('otp_codes')
      .select('created_at')
      .eq('phone', normalized)
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

    // Store OTP in database (use normalized phone)
    const { error: dbError } = await supabase
      .from('otp_codes')
      .insert({
        phone: normalized,
        code,
        expires_at: expiresAt.toISOString(),
      });

    if (dbError) {
      console.error('Database error:', dbError);
      // Handle specific database error codes with controlled responses
      if (dbError.code === '23505') {
        // Unique constraint violation - likely duplicate OTP request
        // Return controlled error instead of throwing
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'OTP generation in progress. Please wait a moment before requesting again.' 
          }),
          { 
            status: 409, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      // For other database errors, throw to be caught by outer catch block
      throw dbError;
    }

    console.log('OTP stored in database, sending SMS...');

    // Send OTP via Twilio using existing send-sms function (use normalized phone)
    // Use direct HTTP fetch instead of supabase.functions.invoke for better reliability
    // when calling from within an edge function
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    console.log('[generate-otp] Calling send-sms via direct HTTP fetch');
    
    let smsResponse: Response;
    let smsResult: any;
    
    try {
      const sendSmsUrl = `${supabaseUrl}/functions/v1/send-sms`;
      console.log('[generate-otp] Fetching:', sendSmsUrl);
      
      smsResponse = await fetch(sendSmsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          to: normalized,
          message: `Your NotifyMe verification code is: ${code}. Valid for 5 minutes.`,
        }),
      });

      console.log('[generate-otp] SMS response status:', smsResponse.status, 'ok:', smsResponse.ok);

      // Parse response JSON (always try to parse, even for error statuses)
      try {
        smsResult = await smsResponse.json();
        console.log('[generate-otp] SMS response body:', JSON.stringify(smsResult).substring(0, 200));
      } catch (jsonError) {
        // If JSON parsing fails, try to get text response
        const textError = await smsResponse.text().catch(() => 'Unable to read response');
        console.error('[generate-otp] Failed to parse SMS response JSON. Status:', smsResponse.status, 'Response:', textError);
        throw new Error(`SMS service returned invalid response: ${textError.substring(0, 200)}`);
      }

      // Check for HTTP-level errors (non-2xx status)
      if (!smsResponse.ok) {
        // Extract error message from response body if available
        const errorMsg = smsResult?.error || smsResult?.message || `SMS service returned status ${smsResponse.status}`;
        console.error('[generate-otp] SMS sending failed with status', smsResponse.status, ':', errorMsg);
        throw new Error(errorMsg);
      }

      // Check for application-level errors in response body (even with 2xx status)
      if (smsResult && typeof smsResult === 'object' && !smsResult.success) {
        const errorMsg = smsResult.error || smsResult.message || 'Failed to send SMS';
        console.error('[generate-otp] SMS sending failed (success=false):', errorMsg);
        throw new Error(errorMsg);
      }

      // Validate response structure
      if (!smsResult || typeof smsResult !== 'object') {
        console.error('[generate-otp] Invalid response from send-sms function:', smsResult);
        throw new Error('Invalid response from SMS service');
      }
    } catch (smsError: any) {
      console.error('[generate-otp] Error sending SMS:', smsError);
      console.error('[generate-otp] Error type:', smsError?.constructor?.name);
      console.error('[generate-otp] Error message:', smsError?.message);
      // Extract meaningful error message
      const errorMsg = smsError.message || 'Failed to send SMS';
      throw new Error(errorMsg);
    }

    console.log('SMS sent successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'OTP sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Generate OTP error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    
    // Provide user-friendly error messages
    let errorMessage = error.message || 'Failed to generate OTP';
    let statusCode = 400;
    
    // Map specific error types to appropriate messages
    if (error.message?.includes('Invalid phone number')) {
      errorMessage = error.message;
    } else if (error.message?.includes('TWILIO') || error.message?.includes('SMS')) {
      errorMessage = 'Failed to send verification code. Please try again later.';
      statusCode = 500;
    } else if (error.message?.includes('Database error') || error.code === '23505') {
      errorMessage = 'A system error occurred. Please try again.';
      statusCode = 500;
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }),
      { 
        status: statusCode, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
