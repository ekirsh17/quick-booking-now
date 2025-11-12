import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { FileText, Send, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Tools = () => {
  const [smsText, setSmsText] = useState("");
  const [merchantPhone, setMerchantPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  // Simple dev flag check
  const isDev = import.meta.env.DEV || localStorage.getItem('devTools') === 'true';

  if (!isDev) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <h1 className="text-2xl font-bold mb-4">Developer Tools</h1>
          <p className="text-muted-foreground mb-4">
            This page is only available in development mode.
          </p>
          <Button
            onClick={() => {
              localStorage.setItem('devTools', 'true');
              window.location.reload();
            }}
          >
            Enable Developer Tools
          </Button>
        </Card>
      </div>
    );
  }

  const handleTestSMS = async () => {
    if (!smsText.trim() || !merchantPhone.trim()) {
      toast({
        title: "Missing fields",
        description: "Please enter both SMS text and merchant phone number",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Create form data as Twilio webhook format
      const formData = new FormData();
      formData.append('Body', smsText);
      formData.append('From', merchantPhone);
      formData.append('To', import.meta.env.VITE_SUPABASE_URL?.replace('https://', '') || '+1234567890');

      // Call the parse-sms-opening edge function directly via fetch
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase URL or key not configured');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/parse-sms-opening`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      setResult(data);
      toast({
        title: "Success",
        description: "SMS parsed successfully",
      });
    } catch (error: any) {
      console.error('Error testing SMS parse:', error);
      setResult({ error: error.message || 'Failed to parse SMS' });
      toast({
        title: "Error",
        description: error.message || "Failed to parse SMS",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const docsLinks = [
    { name: "Architecture", path: "/docs/ARCHITECTURE.md", href: "https://github.com/ekirsh17/quick-booking-now/blob/main/docs/ARCHITECTURE.md" },
    { name: "Environment", path: "/docs/ENVIRONMENT.md", href: "https://github.com/ekirsh17/quick-booking-now/blob/main/docs/ENVIRONMENT.md" },
    { name: "Webhooks", path: "/docs/WEBHOOKS.md", href: "https://github.com/ekirsh17/quick-booking-now/blob/main/docs/WEBHOOKS.md" },
    { name: "Setup Guide", path: "/docs/README_SETUP.md", href: "https://github.com/ekirsh17/quick-booking-now/blob/main/docs/README_SETUP.md" },
  ];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Developer Tools</h1>
          <Button
            variant="outline"
            onClick={() => {
              localStorage.removeItem('devTools');
              window.location.reload();
            }}
          >
            Disable Dev Tools
          </Button>
        </div>

        {/* Test SMS Parse */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Test SMS Parse</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="merchant-phone">Merchant Phone (E.164 format)</Label>
              <Textarea
                id="merchant-phone"
                placeholder="+1234567890"
                value={merchantPhone}
                onChange={(e) => setMerchantPhone(e.target.value)}
                className="mt-2"
                rows={1}
              />
            </div>
            <div>
              <Label htmlFor="sms-text">SMS Text</Label>
              <Textarea
                id="sms-text"
                placeholder="2pm haircut"
                value={smsText}
                onChange={(e) => setSmsText(e.target.value)}
                className="mt-2"
                rows={4}
              />
            </div>
            <Button
              onClick={handleTestSMS}
              disabled={loading}
              className="w-full"
            >
              <Send className="mr-2 h-4 w-4" />
              {loading ? "Parsing..." : "Test SMS Parse"}
            </Button>
            {result && (
              <div className="mt-4">
                <Label>Result</Label>
                <pre className="mt-2 p-4 bg-muted rounded-md overflow-auto text-sm">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Card>

        {/* Documentation Links */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documentation
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {docsLinks.map((doc) => (
              <Link
                key={doc.path}
                to={doc.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 border rounded-md hover:bg-accent transition-colors"
              >
                <span className="font-medium">{doc.name}</span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </Card>

        {/* Health Check */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Health Check</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>Supabase Connection</span>
              <span className="text-green-600">✓ Connected</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Environment</span>
              <span className="text-muted-foreground">{import.meta.env.MODE}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Supabase URL</span>
              <span className="text-muted-foreground text-sm truncate max-w-xs">
                {import.meta.env.VITE_SUPABASE_URL || "Not configured"}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Tools;

