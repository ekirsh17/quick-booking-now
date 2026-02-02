import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhoneToE164 } from "../shared/phoneNormalization.ts";

/**
 * OTP Verification Edge Function
 * Verifies 6-digit OTP codes sent via SMS and creates user sessions.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function findExistingUserId(
  supabase: ReturnType<typeof createClient>,
  normalizedPhone: string,
  dummyEmail: string
): Promise<string | null> {
  try {
    const { data: merchant } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', normalizedPhone)
      .limit(1)
      .maybeSingle();
    if (merchant?.id) return merchant.id;
  } catch (error) {
    console.log('Error checking profiles for existing user:', error);
  }

  try {
    const { data: consumer } = await supabase
      .from('consumers')
      .select('user_id')
      .eq('phone', normalizedPhone)
      .limit(1)
      .maybeSingle();
    if (consumer?.user_id) return consumer.user_id;
  } catch (error) {
    console.log('Error checking consumers for existing user:', error);
  }

  try {
    const { data: authByPhone } = await supabase
      .schema('auth')
      .from('users')
      .select('id')
      .eq('phone', normalizedPhone)
      .limit(1)
      .maybeSingle();
    if (authByPhone?.id) return authByPhone.id;
  } catch (error) {
    console.log('Error checking auth users by phone:', error);
  }

  try {
    const { data: authByEmail } = await supabase
      .schema('auth')
      .from('users')
      .select('id')
      .eq('email', dummyEmail)
      .limit(1)
      .maybeSingle();
    if (authByEmail?.id) return authByEmail.id;
  } catch (error) {
    console.log('Error checking auth users by email:', error);
  }

  return null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, code } = await req.json();

    console.log('Verify OTP request for phone:', phone?.substring(0, 5) + '***');

    // Normalize phone to E.164 format using centralized utility
    let normalized: string;
    try {
      normalized = normalizePhoneToE164(phone);
      console.log('Normalized phone to E.164 format:', normalized.substring(0, 5) + '***');
    } catch (normalizationError: any) {
      console.error('Phone normalization error:', normalizationError);
      throw new Error(`Invalid phone number format: ${normalizationError.message}. Please use international format (e.g., +12125551234)`);
    }

    if (!code || !/^\d{6}$/.test(code)) {
      throw new Error('Please enter a valid 6-digit code');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // OTP verification - no backdoors, all codes must be verified
    const { data: otpRecord, error: otpError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone', normalized)
      .eq('code', code)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (otpError) {
      console.error('Database error:', otpError);
      throw otpError;
    }

    if (!otpRecord) {
      console.log('Invalid or expired OTP for phone:', normalized?.substring(0, 5) + '***');
      throw new Error('Invalid or expired OTP code');
    }

    // Check attempts (max 3)
    if (otpRecord.attempts >= 3) {
      console.log('Too many attempts for phone:', normalized?.substring(0, 5) + '***');
      throw new Error('Too many failed attempts. Please request a new code.');
    }

    console.log('Valid OTP found, marking as verified');

    // Mark OTP as verified
    await supabase
      .from('otp_codes')
      .update({ verified: true })
      .eq('id', otpRecord.id);

    // Create dummy email for phone-only users (use normalized phone)
    const dummyEmail = `${normalized.replace(/\+/g, '')}@phone.notifyme.app`;

    let userId: string;
    let accessToken: string;
    let refreshToken: string;

    // Try to find existing user without scanning all auth users
    let userExists = false;
    let existingUserId: string | null = null;

    try {
      const foundUserId = await findExistingUserId(supabase, normalized, dummyEmail);
      if (foundUserId) {
        userExists = true;
        existingUserId = foundUserId;
      }
    } catch (error) {
      console.log('Error checking for existing user:', error);
    }

    if (!userExists) {
      console.log('Creating new user for phone:', normalized?.substring(0, 5) + '***');
      
      // Create new user with phone and dummy email (use normalized phone)
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        phone: normalized,
        email: dummyEmail,
        phone_confirm: true,
        email_confirm: true,
      });

      if (createError) {
        // If user already exists with this email, try to find them without listing all users
        if (createError.message.includes('already been registered')) {
          console.log('User already exists, attempting to find them');
          const foundUserId = await findExistingUserId(supabase, normalized, dummyEmail);
          if (foundUserId) {
            console.log('Found existing user:', foundUserId);
            userId = foundUserId;
            userExists = true;
            
            // Make sure phone is confirmed
            await supabase.auth.admin.updateUserById(userId, {
              phone_confirm: true,
            });
          } else {
            // Last-resort fallback (avoid regression if auth lookup fails)
            console.log('Falling back to listUsers for existing user lookup');
            const { data: users } = await supabase.auth.admin.listUsers();
            const existingUser = users.users.find(u => u.email === dummyEmail || u.phone === normalized);
            if (existingUser) {
              console.log('Found existing user:', existingUser.id);
              userId = existingUser.id;
              userExists = true;
              await supabase.auth.admin.updateUserById(userId, {
                phone_confirm: true,
              });
            } else {
              throw new Error('User exists but could not be found');
            }
          }
        } else {
          console.error('User creation error:', createError);
          throw createError;
        }
      } else {
        userId = newUser.user.id;
      }
    } else {
      console.log('Existing user found for phone:', normalized?.substring(0, 5) + '***');
      userId = existingUserId!;
      
      // Make sure phone is confirmed
      await supabase.auth.admin.updateUserById(userId, {
        phone_confirm: true,
      });
    }

    // Generate magic link to get session tokens
    // We use generateLink to create a token that we can then verify to get a session
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: dummyEmail,
    });

    if (linkError) {
      console.error('Link generation error:', linkError);
      throw linkError;
    }

    // Extract the token_hash from the properties
    const tokenHash = linkData.properties?.hashed_token;
    
    if (!tokenHash) {
      console.error('No hashed_token in generateLink response');
      throw new Error('Failed to extract token from authentication link');
    }
    
    // Exchange token_hash for session using direct HTTP call to auth endpoint
    // We use anon key for this call (not service role) since it's a user-facing auth operation
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Make direct HTTP POST to /auth/v1/verify endpoint
    const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        token_hash: tokenHash,
        type: 'email',
      }),
    });

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error('Session verification failed:', verifyResponse.status, errorText);
      throw new Error('Failed to create session');
    }

    const sessionData = await verifyResponse.json();
    
    // Supabase verify endpoint sometimes returns tokens at the root level
    const sessionPayload = sessionData.session ?? {
      access_token: sessionData.access_token,
      refresh_token: sessionData.refresh_token,
    };

    if (!sessionPayload?.access_token || !sessionPayload?.refresh_token) {
      console.error('No session tokens in verify response:', sessionData);
      throw new Error('Failed to create session');
    }

    accessToken = sessionPayload.access_token;
    refreshToken = sessionPayload.refresh_token;

    console.log('OTP verification successful for user:', userId);

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        accessToken,
        refreshToken,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    
    // Provide user-friendly error messages
    let errorMessage = error.message || 'Failed to verify OTP';
    let statusCode = 400;
    
    // Map specific error types to appropriate messages
    if (error.message?.includes('Invalid phone number')) {
      errorMessage = error.message;
    } else if (error.message?.includes('Invalid or expired OTP')) {
      errorMessage = 'Invalid or expired verification code. Please try again.';
    } else if (error.message?.includes('Too many failed attempts')) {
      errorMessage = 'Too many failed attempts. Please request a new verification code.';
    } else if (error.message?.includes('Database error') || error.code === '23505') {
      errorMessage = 'A system error occurred. Please try again.';
      statusCode = 500;
    } else if (error.message?.includes('Failed to create session')) {
      errorMessage = 'Failed to sign you in. Please try again.';
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
