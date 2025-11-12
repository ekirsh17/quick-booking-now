import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CalendarSetupGuideProps {
  onClose?: () => void;
}

export const CalendarSetupGuide = ({ onClose }: CalendarSetupGuideProps) => {
  const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-oauth-callback`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Calendar Setup Required</CardTitle>
        <CardDescription>
          Please verify these settings in your Google Cloud Console
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connection Failed</AlertTitle>
          <AlertDescription>
            Google is returning a 403 error. This typically means the OAuth configuration needs adjustment.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Step 1: Verify Authorized Redirect URIs
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              In Google Cloud Console → Credentials → OAuth 2.0 Client IDs, ensure this EXACT URI is added:
            </p>
            <code className="block bg-muted p-2 rounded text-xs break-all">
              {redirectUri}
            </code>
          </div>

          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Step 2: Configure Authorized JavaScript Origins ⚠️ CRITICAL
            </h3>
            <Alert className="mb-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>The "accounts.google.com refused to connect" error is caused by missing JavaScript origins.</strong>
                <br />You MUST add the URL below to "Authorized JavaScript origins" in your OAuth client settings.
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground mb-2">
              In your OAuth 2.0 Client configuration, click "ADD URI" under "Authorized JavaScript origins" and add:
            </p>
            <div className="space-y-2">
              <div>
                <code className="block bg-muted p-2 rounded text-xs break-all font-semibold">
                  {window.location.origin}
                </code>
                <p className="text-xs text-amber-600 font-medium mt-1">
                  ⚠️ After adding, click SAVE and wait 1-2 minutes for changes to propagate before trying again.
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Also add (for local development):</p>
                <code className="block bg-muted p-2 rounded text-xs break-all">
                  http://localhost:8080
                </code>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Step 3: Check OAuth Consent Screen
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              Go to <strong>APIs & Services → OAuth consent screen</strong>:
            </p>
            <ul className="text-sm space-y-2 list-disc list-inside text-muted-foreground">
              <li>Check <strong>Publishing status</strong> at the top - if it says "Testing", your app is in testing mode</li>
              <li>If in <strong>Testing</strong> mode: Scroll to "Test users" and click "Add Users" - add your Google email address</li>
              <li>Make sure App name and Support email are filled out</li>
              <li>Under Scopes, ensure you have <code className="text-xs bg-muted px-1 py-0.5 rounded">../auth/calendar.readonly</code> added</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Step 4: Enable Google Calendar API
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              Go to <strong>APIs & Services → Library</strong>:
            </p>
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              <li>Search for "Google Calendar API"</li>
              <li>Click on it and press the <strong>Enable</strong> button</li>
              <li>Wait for it to be enabled (may take a few seconds)</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.open('https://console.cloud.google.com/apis/credentials', '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Google Cloud Console
          </Button>
          {onClose && (
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
