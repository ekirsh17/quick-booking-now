import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // User ID
    const error = url.searchParams.get('error');

    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:8080';

    if (error || !code || !state) {
      console.error('OAuth error or missing params:', { error, code, state });
      return Response.redirect(`${frontendUrl}/merchant/settings?calendar_error=access_denied`);
    }

    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
    const encryptionKey = Deno.env.get('CALENDAR_ENCRYPTION_KEY');
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-oauth-callback`;

    if (!clientId || !clientSecret || !encryptionKey) {
      throw new Error('OAuth credentials not configured');
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      throw new Error('Failed to exchange authorization code');
    }

    const tokens = await tokenResponse.json();

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user info');
    }

    const userInfo = await userInfoResponse.json();

    // Store encrypted credentials in Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const credentials = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + (tokens.expires_in * 1000),
    };

    // Use the encryption function
    const { data: encryptedData, error: encryptError } = await supabase.rpc(
      'encrypt_calendar_credentials',
      {
        credentials_json: credentials,
        encryption_key: encryptionKey,
      }
    );

    if (encryptError) {
      console.error('Encryption error:', encryptError);
      throw new Error('Failed to encrypt credentials');
    }

    // Upsert calendar account
    const { error: upsertError } = await supabase
      .from('external_calendar_accounts')
      .upsert(
        {
          merchant_id: state,
          provider: 'google',
          email: userInfo.email,
          encrypted_credentials: encryptedData,
          status: 'connected',
          meta: { user_info: userInfo },
        },
        { onConflict: 'merchant_id,provider,email' }
      );

    if (upsertError) {
      console.error('Database error:', upsertError);
      throw new Error('Failed to store calendar account');
    }

    console.log('Calendar connected successfully for user:', state);

    return Response.redirect(`${frontendUrl}/merchant/settings?calendar_success=true`);
  } catch (error) {
    console.error('Error in google-calendar-oauth-callback:', error);
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:8080';
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return Response.redirect(`${frontendUrl}/merchant/settings?calendar_error=${encodeURIComponent(errorMessage)}`);
  }
});
