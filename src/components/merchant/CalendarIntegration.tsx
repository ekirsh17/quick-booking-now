import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Loader2, RefreshCw, Unplug, HelpCircle } from 'lucide-react';
import { useCalendarAccounts } from '@/hooks/useCalendarAccounts';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CalendarSetupGuide } from './CalendarSetupGuide';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
export const CalendarIntegration = () => {
  const {
    accounts,
    loading,
    syncing,
    connectGoogle,
    disconnectAccount,
    syncCalendar
  } = useCalendarAccounts();
  const {
    toast
  } = useToast();
  const [showGuide, setShowGuide] = useState(false);
  useEffect(() => {
    // Check for OAuth callback success/error
    const params = new URLSearchParams(window.location.search);
    const success = params.get('calendar_success');
    const error = params.get('calendar_error');
    if (success) {
      toast({
        title: 'Success',
        description: 'Google Calendar connected successfully'
      });
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      setShowGuide(true);
      toast({
        title: 'Connection Failed',
        description: 'Please check your Google Cloud Console configuration',
        variant: 'destructive'
      });
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);
  const connectedAccounts = accounts.filter(a => a.status === 'connected');
  return <>
      {showGuide && <CalendarSetupGuide onClose={() => setShowGuide(false)} />}
      
      <Card>
        <CardHeader>
          
          <CardDescription>Connect your Google Calendar to automatically s</CardDescription>
        </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div> : connectedAccounts.length > 0 ? <div className="space-y-4">
            {connectedAccounts.map(account => <div key={account.id} className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <CalendarIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{account.email}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        Google Calendar
                      </Badge>
                      <Badge variant="outline" className="text-xs text-green-600">
                        Connected
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={syncCalendar} 
                    disabled={syncing}
                    className="w-full hover:bg-accent/10 hover:text-accent hover:border-accent/30"
                  >
                    {syncing ? <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Syncing...
                      </> : <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sync Now
                      </>}
                  </Button>
                  <Button 
                    variant="link" 
                    size="sm"
                    onClick={() => disconnectAccount(account.id)}
                    className="h-auto py-2 px-3 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Disconnect
                  </Button>
                </div>
              </div>)}
            
          </div> : <div className="text-center py-8 space-y-4">
            <p className="text-muted-foreground">
              No calendar accounts connected yet
            </p>
            <Button onClick={connectGoogle}>
              <CalendarIcon className="h-4 w-4 mr-2" />
              Connect Google Calendar
            </Button>
          </div>}
      </CardContent>
    </Card>
    </>;
};