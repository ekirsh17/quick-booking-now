import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, ExternalLink } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useActivationContext } from '@/contexts/ActivationContext';
import { BOOKING_SYSTEM_OPTIONS } from '@/types/bookingSystems';
import { TIMEZONE_OPTIONS } from '@/types/onboarding';
import type { SetupDrawerId } from '@/types/activationSetup';
import { validateAndNormalizeBookingUrl } from '@/utils/bookingUrl';
import { formatUrlForDisplay } from '@/utils/displayUrl';
import { cn } from '@/lib/utils';

function getInboundStatusLabel(status: string | null, verifiedAt: string | null): string {
  if (!status) return 'Not connected';
  if (status === 'active' || verifiedAt) return 'Active';
  return 'Waiting for first cancellation email';
}

function notifyMerchantProfileUpdated() {
  window.dispatchEvent(new Event('openalert:merchant-profile-updated'));
}

export function SetupDrawers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { activeDrawer, closeDrawer, profile, markQrEngaged } = useActivationContext();

  const [saving, setSaving] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');

  const [bookingPath, setBookingPath] = useState<'external' | 'manual'>('external');
  const [bookingSystemProvider, setBookingSystemProvider] = useState('');
  const [bookingUrl, setBookingUrl] = useState('');

  const [cancellationMode, setCancellationMode] = useState<'auto' | 'manual'>('manual');
  const [autoOpeningsEnabled, setAutoOpeningsEnabled] = useState(false);
  const [inboundEmailAddress, setInboundEmailAddress] = useState('');
  const [inboundStatusLabel, setInboundStatusLabel] = useState('Not connected');

  const [confirmationMode, setConfirmationMode] = useState<'manual' | 'external'>('manual');

  useEffect(() => {
    if (!activeDrawer) return;

    setBusinessName(profile.business_name || '');
    setEmail(profile.email || '');
    setPhone(profile.phone || '');
    setAddress(profile.address || '');
    setTimezone(profile.time_zone || 'America/New_York');

    setBookingPath(profile.use_booking_system ? 'external' : 'manual');
    setBookingSystemProvider(profile.booking_system_provider || '');
    setBookingUrl(formatUrlForDisplay(profile.booking_url || ''));

    setCancellationMode(profile.auto_openings_enabled ? 'auto' : 'manual');
    setAutoOpeningsEnabled(Boolean(profile.auto_openings_enabled));
    setInboundStatusLabel(
      getInboundStatusLabel(profile.inbound_email_status, profile.inbound_email_verified_at)
    );

    setConfirmationMode(
      profile.use_booking_system && !profile.require_confirmation ? 'external' : 'manual'
    );
  }, [activeDrawer, profile]);

  useEffect(() => {
    if (activeDrawer !== 'cancellation-automation' || cancellationMode !== 'auto') {
      return;
    }

    const loadInbound = async () => {
      const { data, error } = await supabase.rpc('ensure_inbound_email');
      if (error) {
        console.error('Failed to load inbound email:', error);
        return;
      }
      const config = Array.isArray(data) ? data[0] : data;
      if (config?.inbound_email_address) {
        setInboundEmailAddress(config.inbound_email_address);
      }
      if (config?.inbound_email_status) {
        setInboundStatusLabel(getInboundStatusLabel(config.inbound_email_status, config.inbound_email_verified_at));
      }
    };

    void loadInbound();
  }, [activeDrawer, cancellationMode]);

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    if (!businessName.trim() || !phone.trim() || !email.trim()) {
      toast({ title: 'Missing fields', description: 'Business name, phone, and email are required.', variant: 'destructive' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast({ title: 'Invalid email', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        business_name: businessName.trim(),
        email: email.trim(),
        phone,
        address: address.trim(),
        time_zone: timezone,
      })
      .eq('id', user.id);

    if (profile.default_location_id) {
      await supabase
        .from('locations')
        .update({ address: address.trim() || null, phone, time_zone: timezone })
        .eq('id', profile.default_location_id);
    }

    setSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }

    notifyMerchantProfileUpdated();
    toast({ title: 'Profile saved' });
    closeDrawer();
  };

  const handleSaveBookingMethod = async () => {
    if (!user?.id) return;

    const useExternal = bookingPath === 'external';
    let normalizedUrl: string | null = null;

    if (useExternal) {
      if (!bookingSystemProvider) {
        toast({ title: 'Select a booking system', variant: 'destructive' });
        return;
      }
      const urlResult = validateAndNormalizeBookingUrl(bookingUrl);
      if (!urlResult.ok) {
        toast({ title: 'Invalid booking URL', description: urlResult.error, variant: 'destructive' });
        return;
      }
      normalizedUrl = urlResult.value;
    }

    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('profiles')
      .update({
        use_booking_system: useExternal,
        booking_system_provider: useExternal ? bookingSystemProvider : null,
        booking_url: useExternal ? normalizedUrl : null,
        require_confirmation: useExternal ? false : true,
        setup_booking_method_confirmed_at: now,
        ...(useExternal ? {} : { setup_confirmation_confirmed_at: now }),
      })
      .eq('id', user.id);

    setSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Booking method saved' });
    notifyMerchantProfileUpdated();
    closeDrawer();
  };

  const handleSaveCancellation = async () => {
    if (!user?.id) return;

    const auto = cancellationMode === 'auto';
    if (auto && !profile.use_booking_system) {
      toast({
        title: 'External booking required',
        description: 'Set an external booking method before enabling auto-create from emails.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('profiles')
      .update({
        auto_openings_enabled: auto,
        setup_cancellation_confirmed_at: now,
      })
      .eq('id', user.id);

    setSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Automation settings saved' });
    notifyMerchantProfileUpdated();
    closeDrawer();
  };

  const handleSaveConfirmation = async () => {
    if (!user?.id) return;

    const manual = confirmationMode === 'manual';
    if (!manual && !profile.use_booking_system && bookingPath !== 'external') {
      toast({
        title: 'External booking required',
        description: 'Choose an external booking method first.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('profiles')
      .update({
        require_confirmation: manual,
        use_booking_system: manual ? false : true,
        setup_confirmation_confirmed_at: now,
      })
      .eq('id', user.id);

    setSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Confirmation rules saved' });
    notifyMerchantProfileUpdated();
    closeDrawer();
  };

  const handleCopyForwarding = async () => {
    if (!inboundEmailAddress) return;
    try {
      await navigator.clipboard.writeText(inboundEmailAddress);
      toast({ title: 'Forwarding address copied' });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const handleQrDone = async () => {
    await markQrEngaged();
    closeDrawer();
  };

  const handleCreateOpening = () => {
    closeDrawer();
    navigate('/merchant/openings?action=create');
  };

  const drawerTitle: Record<SetupDrawerId, string> = {
    'business-profile': 'Confirm business profile',
    'booking-method': 'Set booking preferences',
    'cancellation-automation': 'Choose cancellation automation',
    'confirmation-rules': 'Review confirmation rules',
    'share-qr': 'Share your waitlist',
    'create-opening': 'Create your first opening',
  };

  const drawerBody: Record<SetupDrawerId, string> = {
    'business-profile': 'These details appear in customer-facing waitlist and alert experiences.',
    'booking-method': 'Choose where customers go after they receive an opening alert.',
    'cancellation-automation':
      'Decide whether OpenAlert should create openings automatically when cancellation emails come in.',
    'confirmation-rules':
      'Choose whether your team reviews booking requests before customers are told they’re booked.',
    'share-qr': 'Customers join from your QR code or link so they can be notified when time opens up.',
    'create-opening': 'Post a real or test slot to see how customer notifications work.',
  };

  const renderDrawerContent = () => {
    switch (activeDrawer) {
      case 'business-profile':
        return (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="setup-business-name">Business name</Label>
              <Input id="setup-business-name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup-email">Email</Label>
              <Input id="setup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <PhoneInput value={phone} onChange={setPhone} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup-address">Address</Label>
              <Input id="setup-address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      case 'booking-method':
        return (
          <div className="space-y-4 py-2">
            <p className="text-sm font-medium">How should customers book after they receive an alert?</p>
            <div className="space-y-2">
              <button
                type="button"
                className={cn(
                  'w-full rounded-lg border p-3 text-left text-sm transition-colors',
                  bookingPath === 'external' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                )}
                onClick={() => setBookingPath('external')}
              >
                Send customers to my existing booking page
              </button>
              <button
                type="button"
                className={cn(
                  'w-full rounded-lg border p-3 text-left text-sm transition-colors',
                  bookingPath === 'manual' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                )}
                onClick={() => setBookingPath('manual')}
              >
                Let my team confirm requests manually in OpenAlert
              </button>
            </div>
            {bookingPath === 'external' ? (
              <div className="space-y-3 border-t pt-3">
                <div className="space-y-2">
                  <Label>Booking system</Label>
                  <Select value={bookingSystemProvider} onValueChange={setBookingSystemProvider}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select system" />
                    </SelectTrigger>
                    <SelectContent>
                      {BOOKING_SYSTEM_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-booking-url">Booking system URL</Label>
                  <Input
                    id="setup-booking-url"
                    type="url"
                    placeholder="booksy.com/your-business"
                    value={bookingUrl}
                    onChange={(e) => setBookingUrl(e.target.value)}
                    onBlur={() => setBookingUrl((current) => formatUrlForDisplay(current))}
                  />
                </div>
              </div>
            ) : null}
          </div>
        );
      case 'cancellation-automation':
        return (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <button
                type="button"
                className={cn(
                  'w-full rounded-lg border p-3 text-left text-sm',
                  cancellationMode === 'auto' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                )}
                onClick={() => {
                  setCancellationMode('auto');
                  setAutoOpeningsEnabled(true);
                }}
              >
                Auto-create openings from cancellation emails
              </button>
              <button
                type="button"
                className={cn(
                  'w-full rounded-lg border p-3 text-left text-sm',
                  cancellationMode === 'manual' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                )}
                onClick={() => {
                  setCancellationMode('manual');
                  setAutoOpeningsEnabled(false);
                }}
              >
                I&apos;ll post openings manually for now
              </button>
            </div>
            {cancellationMode === 'auto' ? (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Auto-create from cancellations</p>
                    <p className="text-xs text-muted-foreground">Status: {inboundStatusLabel}</p>
                  </div>
                  <Switch checked={autoOpeningsEnabled} onCheckedChange={setAutoOpeningsEnabled} />
                </div>
                {inboundEmailAddress ? (
                  <div className="space-y-2">
                    <Label className="text-xs">Forwarding address</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={inboundEmailAddress} className="text-xs" />
                      <Button type="button" variant="outline" size="icon" onClick={() => void handleCopyForwarding()}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      case 'confirmation-rules':
        return (
          <div className="space-y-4 py-2">
            <button
              type="button"
              className={cn(
                'w-full rounded-lg border p-3 text-left',
                confirmationMode === 'manual' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              )}
              onClick={() => setConfirmationMode('manual')}
            >
              <p className="text-sm font-medium">Require manual confirmation</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your team reviews requests before customers are confirmed.
              </p>
            </button>
            <button
              type="button"
              className={cn(
                'w-full rounded-lg border p-3 text-left',
                confirmationMode === 'external' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              )}
              onClick={() => setConfirmationMode('external')}
            >
              <p className="text-sm font-medium">Let customers claim through my booking link</p>
              <p className="text-xs text-muted-foreground mt-1">
                Customers are sent to your booking page to complete the appointment.
              </p>
            </button>
          </div>
        );
      case 'share-qr':
        return (
          <div className="space-y-3 py-2">
            <Button asChild variant="outline" className="w-full min-h-11 justify-start" onClick={() => void markQrEngaged()}>
              <Link to="/merchant/qr-code" className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                View QR page
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">
              Copy your link or download your QR on the QR page to complete this step.
            </p>
          </div>
        );
      case 'create-opening':
        return (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Post a slot on your calendar to notify waitlisted customers.
            </p>
            <Button type="button" className="w-full min-h-11" onClick={handleCreateOpening}>
              Create opening
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  const renderFooter = () => {
    switch (activeDrawer) {
      case 'business-profile':
        return (
          <Button type="button" className="w-full min-h-11" disabled={saving} onClick={() => void handleSaveProfile()}>
            Save profile
          </Button>
        );
      case 'booking-method':
        return (
          <Button type="button" className="w-full min-h-11" disabled={saving} onClick={() => void handleSaveBookingMethod()}>
            Save booking method
          </Button>
        );
      case 'cancellation-automation':
        return (
          <Button type="button" className="w-full min-h-11" disabled={saving} onClick={() => void handleSaveCancellation()}>
            Save automation settings
          </Button>
        );
      case 'confirmation-rules':
        return (
          <Button type="button" className="w-full min-h-11" disabled={saving} onClick={() => void handleSaveConfirmation()}>
            Save confirmation rules
          </Button>
        );
      case 'share-qr':
        return (
          <Button type="button" className="w-full min-h-11" onClick={() => void handleQrDone()}>
            Done
          </Button>
        );
      case 'create-opening':
        return null;
      default:
        return null;
    }
  };

  return (
    <Sheet open={activeDrawer != null} onOpenChange={(open) => !open && closeDrawer()}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        {activeDrawer ? (
          <>
            <SheetHeader>
              <SheetTitle>{drawerTitle[activeDrawer]}</SheetTitle>
              <SheetDescription>{drawerBody[activeDrawer]}</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-1">{renderDrawerContent()}</div>
            <SheetFooter className="mt-auto pt-4">{renderFooter()}</SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
