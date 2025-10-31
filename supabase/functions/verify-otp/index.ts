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
    const { phone, code } = await req.json();

    console.log('Verify OTP request for phone:', phone);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Development bypass mode
    const BYPASS_MODE = Deno.env.get('BYPASS_OTP_CHECK') === 'true';

    if (BYPASS_MODE) {
      console.log('⚠️ DEVELOPMENT BYPASS MODE ENABLED - Any 6-digit code accepted');
      
      // Just validate format
      if (!/^\d{6}$/.test(code)) {
        throw new Error('Please enter a 6-digit code');
      }
      
      console.log('Development bypass: Code format valid, proceeding with authentication');
    } else {
      // Normal OTP verification
      const { data: otpRecord, error: otpError } = await supabase
        .from('otp_codes')
        .select('*')
        .eq('phone', phone)
        .eq('code', code)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (otpError) {
        console.error('Database error:', otpError);
        throw otpError;
      }

      if (!otpRecord) {
        console.log('Invalid or expired OTP for phone:', phone);
        throw new Error('Invalid or expired OTP code');
      }

      // Check attempts (max 3)
      if (otpRecord.attempts >= 3) {
        console.log('Too many attempts for phone:', phone);
        throw new Error('Too many failed attempts. Please request a new code.');
      }

      console.log('Valid OTP found, marking as verified');

      // Mark OTP as verified
      await supabase
        .from('otp_codes')
        .update({ verified: true })
        .eq('id', otpRecord.id);
    }

    // Create dummy email for phone-only users
    const dummyEmail = `${phone.replace(/\+/g, '')}@phone.notifyme.app`;

    let userId: string;
    let accessToken: string;
    let refreshToken: string;

    // Try to find existing user by email (since we use phone as email)
    let userExists = false;
    let existingUserId: string | null = null;

    try {
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const foundUser = existingUsers.users.find(u => u.email === dummyEmail || u.phone === phone);
      if (foundUser) {
        userExists = true;
        existingUserId = foundUser.id;
      }
    } catch (error) {
      console.log('Error checking for existing user:', error);
    }

    if (!userExists) {
      console.log('Creating new user for phone:', phone);
      
      // Create new user with phone and dummy email
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        phone,
        email: dummyEmail,
        phone_confirm: true,
        email_confirm: true,
      });

      if (createError) {
        // If user already exists with this email, try to find them
        if (createError.message.includes('already been registered')) {
          console.log('User already exists, attempting to find them');
          const { data: users } = await supabase.auth.admin.listUsers();
          const existingUser = users.users.find(u => u.email === dummyEmail || u.phone === phone);
          if (existingUser) {
            console.log('Found existing user:', existingUser.id);
            userId = existingUser.id;
            userExists = true;
            
            // Make sure phone is confirmed
            await supabase.auth.admin.updateUserById(userId, {
              phone_confirm: true,
            });
          } else {
            throw new Error('User exists but could not be found');
          }
        } else {
          console.error('User creation error:', createError);
          throw createError;
        }
      } else {
        userId = newUser.user.id;
      }
    } else {
      console.log('Existing user found for phone:', phone);
      userId = existingUserId!;
      
      // Make sure phone is confirmed
      await supabase.auth.admin.updateUserById(userId, {
        phone_confirm: true,
      });
    }

    // Generate magic link to get session tokens
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: dummyEmail,
    });

    if (linkError) {
      console.error('Link generation error:', linkError);
      throw linkError;
    }

    // Extract tokens from the generated link
    const hashedToken = linkData.properties.hashed_token;
    
    // Exchange hashed token for session
    const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
      token_hash: hashedToken,
      type: 'magiclink',
    });

    if (sessionError || !sessionData.session) {
      console.error('Session error:', sessionError);
      throw new Error('Failed to create session');
    }

    accessToken = sessionData.session.access_token;
    refreshToken = sessionData.session.refresh_token;

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
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
