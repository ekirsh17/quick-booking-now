import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:8080';
  
  try {
    console.log('=== OAuth Callback Started ===');
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // User ID
    const error = url.searchParams.get('error');

    console.log('Callback params:', { hasCode: !!code, hasState: !!state, error });

    if (error || !code || !state) {
      console.error('OAuth error or missing params:', { error, code: !!code, state: !!state });
      return Response.redirect(`${frontendUrl}/merchant/settings?calendar_error=access_denied`);
    }

    // Check all required environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
    const encryptionKey = Deno.env.get('CALENDAR_ENCRYPTION_KEY');
    const redirectUri = `${supabaseUrl}/functions/v1/google-calendar-oauth-callback`;

    console.log('Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasEncryptionKey: !!encryptionKey,
    });

    if (!clientId || !clientSecret || !encryptionKey || !supabaseUrl || !supabaseServiceKey) {
      console.error('Missing required environment variables');
      throw new Error('OAuth credentials not configured properly');
    }

    // Exchange code for tokens
    console.log('Exchanging code for tokens...');
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
    console.log('Tokens received successfully');

    // Get user info from Google
    console.log('Fetching user info from Google...');
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text();
      console.error('Failed to fetch user info:', errorText);
      throw new Error('Failed to fetch user info from Google');
    }

    const userInfo = await userInfoResponse.json();
    console.log('User info received:', { email: userInfo.email });

    // Store encrypted credentials in Supabase
    console.log('Creating Supabase client with service role...');
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const credentials = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + (tokens.expires_in * 1000),
    };

    // Use the encryption function
    console.log('Encrypting credentials...');
    const { data: encryptedData, error: encryptError } = await supabase.rpc(
      'encrypt_calendar_credentials',
      {
        credentials_json: credentials,
        encryption_key: encryptionKey,
      }
    );

    if (encryptError) {
      console.error('Encryption error:', encryptError);
      throw new Error(`Failed to encrypt credentials: ${encryptError.message}`);
    }

    console.log('Credentials encrypted successfully');

    // Upsert calendar account
    console.log('Storing calendar account in database...');
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
      console.error('Database upsert error:', upsertError);
      throw new Error(`Failed to store calendar account: ${upsertError.message}`);
    }

    console.log('=== Calendar connected successfully for user:', state, '===');

    // Return HTML page that sends message to parent window and closes
    const successHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Calendar Connected</title></head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'CALENDAR_OAUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '${frontendUrl}/merchant/settings?calendar_success=true';
            }
          </script>
          <p>Calendar connected successfully! This window should close automatically...</p>
        </body>
      </html>
    `;
    
    return new Response(successHtml, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('=== ERROR in google-calendar-oauth-callback ===');
    console.error('Error details:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // Return HTML page that sends error to parent window and closes
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Connection Failed</title></head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'CALENDAR_OAUTH_ERROR', 
                error: '${errorMessage.replace(/'/g, "\\'")}'
              }, '*');
              window.close();
            } else {
              window.location.href = '${frontendUrl}/merchant/settings?calendar_error=${encodeURIComponent(errorMessage)}';
            }
          </script>
          <p>Connection failed. This window should close automatically...</p>
        </body>
      </html>
    `;
    
    return new Response(errorHtml, {
      headers: { 'Content-Type': 'text/html' },
    });
  }
});
