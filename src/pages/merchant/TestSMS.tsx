import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import MerchantLayout from "@/components/merchant/MerchantLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, AlertCircle, CheckCircle2, Clock, XCircle, RefreshCw } from "lucide-react";

const VERIFIED_TEST_NUMBER = '+15165879844';

export default function TestSMS() {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const { toast } = useToast();

  // Fetch recent SMS logs
  const { data: smsLogs, refetch } = useQuery({
    queryKey: ['sms-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sms_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const handleSendSMS = async () => {
    if (!message.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    setLastResponse(null);

    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          to: VERIFIED_TEST_NUMBER,
          message: message.trim(),
        },
      });

      if (error) throw error;

      setLastResponse(data);
      
      if (data.success) {
        toast({
          title: "SMS Sent",
          description: `Message SID: ${data.messageSid}`,
        });
        setMessage('');
        refetch(); // Refresh logs
      } else {
        toast({
          title: "Failed to send",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Send SMS error:', error);
      setLastResponse({ success: false, error: error.message });
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleSendTestOTP = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-otp', {
        body: { phone: VERIFIED_TEST_NUMBER },
      });

      if (error) throw error;

      toast({
        title: "OTP Sent",
        description: "Check your phone for the OTP code",
      });
      refetch();
    } catch (error: any) {
      toast({
        title: "Error sending OTP",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'sent':
      case 'queued':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
      case 'undelivered':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'received':
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-500/10 text-green-700 border-green-200';
      case 'sent':
      case 'queued':
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
      case 'failed':
      case 'undelivered':
        return 'bg-red-500/10 text-red-700 border-red-200';
      case 'received':
        return 'bg-blue-500/10 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  return (
    <MerchantLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">SMS Testing Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Test SMS delivery and monitor message status in real-time
          </p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Testing Mode Active:</strong> SMS can only be sent to verified number: {VERIFIED_TEST_NUMBER}
          </AlertDescription>
        </Alert>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Send Test SMS */}
          <Card>
            <CardHeader>
              <CardTitle>Send Test SMS</CardTitle>
              <CardDescription>Send a custom message to your verified number</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recipient">Recipient (Testing Only)</Label>
                <Input 
                  id="recipient"
                  value={VERIFIED_TEST_NUMBER}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="message">Message</Label>
                  <span className="text-xs text-muted-foreground">{message.length}/160</span>
                </div>
                <Textarea
                  id="message"
                  placeholder="Enter your test message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 160))}
                  rows={4}
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handleSendSMS} 
                  disabled={sending || !message.trim()}
                  className="flex-1"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {sending ? 'Sending...' : 'Send SMS'}
                </Button>
                <Button 
                  onClick={handleSendTestOTP} 
                  disabled={sending}
                  variant="outline"
                >
                  Send Test OTP
                </Button>
              </div>

              {lastResponse && (
                <Alert variant={lastResponse.success ? "default" : "destructive"}>
                  <AlertDescription>
                    {lastResponse.success ? (
                      <div className="space-y-1">
                        <p className="font-medium">✅ SMS Sent Successfully</p>
                        <p className="text-xs font-mono">{lastResponse.messageSid}</p>
                        {lastResponse.warning && (
                          <p className="text-xs text-yellow-600">{lastResponse.warning}</p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium">❌ Failed to Send</p>
                        <p className="text-xs mt-1">{lastResponse.error}</p>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Webhook Info */}
          <Card>
            <CardHeader>
              <CardTitle>Inbound SMS Webhook</CardTitle>
              <CardDescription>Configure this URL in your Twilio Console</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <div className="flex gap-2">
                  <Input 
                    value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-sms-reply`}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-sms-reply`);
                      toast({ title: "Copied to clipboard" });
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted space-y-2">
                <p className="text-sm font-medium">📱 Test Instructions:</p>
                <ol className="text-sm text-muted-foreground space-y-1 ml-4 list-decimal">
                  <li>Configure the webhook URL in Twilio Console</li>
                  <li>Send any SMS to your Twilio number</li>
                  <li>Check the SMS logs below for the inbound message</li>
                  <li>You'll receive an echo reply confirming receipt</li>
                </ol>
              </div>

              <Alert>
                <MessageSquare className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Special Commands:</strong> Reply with "CONFIRM" or "APPROVE" to approve pending bookings
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>

        {/* SMS Logs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>SMS Activity Log</CardTitle>
                <CardDescription>Real-time SMS delivery tracking (updates every 5s)</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!smsLogs || smsLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No SMS activity yet. Send a test message to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {smsLogs.map((log: any) => (
                  <div 
                    key={log.id} 
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="mt-1">
                      {getStatusIcon(log.status)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={getStatusColor(log.status)}>
                          {log.status}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {log.direction === 'inbound' ? '📥 Inbound' : '📤 Outbound'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.sent_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm truncate">{log.body}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>To: {log.to_number}</span>
                        <span>•</span>
                        <span className="font-mono text-xs">{log.message_sid}</span>
                      </div>
                      {log.error_message && (
                        <p className="text-xs text-red-600">Error: {log.error_message}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MerchantLayout>
  );
}
