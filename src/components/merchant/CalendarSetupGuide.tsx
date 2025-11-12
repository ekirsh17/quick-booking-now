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
              Step 2: Verify Authorized JavaScript Origins
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              Add these origins:
            </p>
            <div className="space-y-1">
              <code className="block bg-muted p-2 rounded text-xs break-all">
                {window.location.origin}
              </code>
              <code className="block bg-muted p-2 rounded text-xs break-all">
                http://localhost:8080
              </code>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Step 3: Check OAuth Consent Screen
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              Ensure the OAuth consent screen is configured:
            </p>
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              <li>App name is set</li>
              <li>Support email is provided</li>
              <li>Scopes include Google Calendar API</li>
              <li>If in "Testing" mode, add your email as a test user</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Step 4: Enable Google Calendar API
            </h3>
            <p className="text-sm text-muted-foreground">
              Make sure the Google Calendar API is enabled in your project
            </p>
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
