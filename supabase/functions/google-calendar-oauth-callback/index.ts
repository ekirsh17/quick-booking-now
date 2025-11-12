import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  // Detect frontend URL from referer or use fallback
  const referer = req.headers.get('referer');
  let frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:8080';
  
  // If we have a referer from preview or deployed URL, use its origin
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.hostname.includes('lovableproject.com') || refererUrl.hostname.includes('lovable.app')) {
        frontendUrl = refererUrl.origin;
      }
    } catch (e) {
      console.log('Could not parse referer:', e);
    }
  }
  
  console.log('Frontend URL detected:', frontendUrl);
  
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
        <head>
          <title>Calendar Connected</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 2rem;
              border-radius: 1rem;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 400px;
            }
            h1 { color: #4c1d95; margin: 0 0 1rem 0; }
            p { color: #6b7280; margin: 0.5rem 0; }
            .spinner {
              width: 40px;
              height: 40px;
              margin: 1rem auto;
              border: 3px solid #e5e7eb;
              border-top: 3px solid #667eea;
              border-radius: 50%;
              animation: spin 1s linear infinite;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            button {
              margin-top: 1rem;
              padding: 0.75rem 1.5rem;
              background: #667eea;
              color: white;
              border: none;
              border-radius: 0.5rem;
              font-size: 1rem;
              cursor: pointer;
              display: none;
            }
            button:hover { background: #5568d3; }
            #close-btn.show { display: inline-block; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✓ Calendar Connected!</h1>
            <div class="spinner"></div>
            <p id="status">Syncing your bookings...</p>
            <button id="close-btn" onclick="window.close() || (window.location.href='${frontendUrl}/merchant/settings?calendar_success=true')">Close Window</button>
          </div>
          <script>
            let attempts = 0;
            const maxAttempts = 5;
            const statusEl = document.getElementById('status');
            const closeBtn = document.getElementById('close-btn');
            
            function tryClose() {
              attempts++;
              console.log('Attempt', attempts, 'to close popup');
              
              if (window.opener && !window.opener.closed) {
                console.log('Sending success message to opener');
                window.opener.postMessage({ type: 'CALENDAR_OAUTH_SUCCESS' }, '*');
                
                // Try to close after a delay
                setTimeout(() => {
                  const closed = window.close();
                  if (!closed) {
                    console.log('Could not close window, showing button');
                    statusEl.textContent = 'Click below to return to settings';
                    closeBtn.classList.add('show');
                  }
                }, 1000);
              } else if (attempts < maxAttempts) {
                console.log('No opener found, retrying...');
                setTimeout(tryClose, 500);
              } else {
                console.log('Max attempts reached, redirecting...');
                statusEl.textContent = 'Redirecting...';
                setTimeout(() => {
                  window.location.href = '${frontendUrl}/merchant/settings?calendar_success=true';
                }, 1000);
              }
            }
            
            // Start immediately
            tryClose();
            
            // Also show button after 3 seconds as fallback
            setTimeout(() => {
              if (window.opener) {
                statusEl.textContent = 'If this window does not close, click below';
                closeBtn.classList.add('show');
              }
            }, 3000);
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
