import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  let frontendUrl = 'https://quick-booking-now.lovable.app';
  let userId = '';
  
  try {
    console.log('=== OAuth Callback Started ===');
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Decode state parameter to get userId and frontendUrl
    if (stateParam) {
      try {
        const stateData = JSON.parse(atob(stateParam));
        userId = stateData.userId;
        frontendUrl = stateData.frontendUrl || frontendUrl;
        console.log('Decoded state:', { userId, frontendUrl });
      } catch (e) {
        console.error('Failed to decode state:', e);
        // Fallback: treat state as userId (backward compatibility)
        userId = stateParam;
      }
    }

    console.log('Callback params:', { hasCode: !!code, hasState: !!stateParam, error, frontendUrl });

    if (error || !code || !userId) {
      console.error('OAuth error or missing params:', { error, code: !!code, userId: !!userId });
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
          merchant_id: userId,
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

    console.log('=== Calendar connected successfully for user:', userId, '===');

    // Return HTML that posts message to parent and closes popup
    const successHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Google Calendar Connected</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .message {
            text-align: center;
            padding: 2rem;
          }
          .spinner {
            border: 3px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top: 3px solid white;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="message">
          <div class="spinner"></div>
          <h2>Calendar Connected!</h2>
          <p>Closing window...</p>
        </div>
        <script>
          (function() {
            try {
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage({
                  type: 'google-calendar-oauth',
                  success: true
                }, '${frontendUrl}');
                setTimeout(() => window.close(), 1000);
              } else {
                // Fallback: redirect if no opener
                window.location.href = '${frontendUrl}/merchant/settings?calendar_success=true';
              }
            } catch (e) {
              console.error('Error posting message:', e);
              window.location.href = '${frontendUrl}/merchant/settings?calendar_success=true';
            }
          })();
        </script>
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
    
    // Return HTML that posts error message to parent
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Calendar Connection Failed</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
            color: #333;
          }
          .message {
            text-align: center;
            padding: 2rem;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-width: 400px;
          }
          .error-icon {
            font-size: 48px;
            margin-bottom: 1rem;
          }
          a {
            color: #667eea;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="message">
          <div class="error-icon">⚠️</div>
          <h2>Connection Failed</h2>
          <p>${errorMessage}</p>
          <p><a href="${frontendUrl}/merchant/settings">Return to app</a></p>
          <p style="font-size: 12px; color: #666; margin-top: 1rem;">This window will close automatically...</p>
        </div>
        <script>
          (function() {
            try {
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage({
                  type: 'google-calendar-oauth',
                  success: false,
                  error: '${errorMessage.replace(/'/g, "\\'")}'
                }, '${frontendUrl}');
                setTimeout(() => window.close(), 3000);
              } else {
                setTimeout(() => {
                  window.location.href = '${frontendUrl}/merchant/settings?calendar_error=${encodeURIComponent(errorMessage)}';
                }, 3000);
              }
            } catch (e) {
              console.error('Error posting message:', e);
              setTimeout(() => {
                window.location.href = '${frontendUrl}/merchant/settings?calendar_error=${encodeURIComponent(errorMessage)}';
              }, 3000);
            }
          })();
        </script>
      </body>
      </html>
    `;

    return new Response(errorHtml, {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
});
