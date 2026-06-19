import { BOOKING_SYSTEM_OPTIONS } from '@/types/bookingSystems';

export type BookingSystemSlug = (typeof BOOKING_SYSTEM_OPTIONS)[number]['value'];
export type EmailSyncPathKind = 'platform_recipient' | 'email_forwarding';
export type DirectRecipientSupport = 'yes' | 'limited' | 'unknown';
export type EmailClientKind = 'gmail' | 'outlook' | 'other';

export type EmailSyncStep =
  | string
  | { before: string; chip: true; after: string };

export const AUTO_OPENINGS_SETUP_TITLE = 'Automatically create openings';
export const EMAIL_SYNC_PROVIDER_LABEL = 'Which email do cancellations go to?';
export const EMAIL_SYNC_EMPTY_PLATFORM_MESSAGE =
  'Pick your booking platform to see the exact steps';
export const EMAIL_SYNC_VERIFY_BUTTON_LABEL = 'Verify forwarding';
export const OPENALERT_ADDRESS_CHIP = 'your OpenAlert address';

export function chipStep(before: string, after: string): EmailSyncStep {
  return { before, chip: true, after };
}

export function getAutoOpeningsSetupSubtitle(platformLabel: string): string {
  return `When someone cancels on ${platformLabel}, we post an opening and text your waitlist`;
}

export function getPlatformPathIntro(platformLabel: string): string {
  return `Add your OpenAlert address as a notification email — best if ${platformLabel} lets you add another recipient.`;
}

export function getForwardingPathIntro(platformLabel: string): string {
  return `Auto-forward cancellation emails from your inbox — use this if ${platformLabel} won't let you add another email.`;
}

export interface EmailSyncPlatformGuide {
  platform: BookingSystemSlug;
  platformLabel: string;
  supportsDirectRecipient: DirectRecipientSupport;
  recipientSteps: EmailSyncStep[];
  officialHelpUrl?: string;
}

export interface EmailForwardingGuide {
  client: EmailClientKind;
  label: string;
  steps: EmailSyncStep[];
}

export const EMAIL_CLIENT_OPTIONS: { value: EmailClientKind; label: string }[] = [
  { value: 'gmail', label: 'Gmail' },
  { value: 'outlook', label: 'Outlook' },
  { value: 'other', label: 'Other email' },
];

const PLATFORM_GUIDES: Record<BookingSystemSlug, EmailSyncPlatformGuide> = {
  booksy: {
    platform: 'booksy',
    platformLabel: 'Booksy',
    supportsDirectRecipient: 'yes',
    officialHelpUrl: 'https://support.booksy.com/hc/en-us',
    recipientSteps: [
      'On a computer, sign in to Booksy Biz',
      'Go to Settings → Notifications',
      chipStep('Add ', ' as an email that gets cancellation alerts'),
      'Turn cancellation emails on, then Save',
    ],
  },
  setmore: {
    platform: 'setmore',
    platformLabel: 'Setmore',
    supportsDirectRecipient: 'yes',
    officialHelpUrl: 'https://support.setmore.com/en/collections/3460958-email-notifications',
    recipientSteps: [
      'On a computer, sign in to Setmore',
      'Go to Settings → Notifications',
      chipStep('Add ', ' to emails that receive booking alerts'),
      'Turn on cancellation notifications and save',
    ],
  },
  square: {
    platform: 'square',
    platformLabel: 'Square Appointments',
    supportsDirectRecipient: 'limited',
    officialHelpUrl: 'https://squareup.com/help/us/en/article/5072-set-up-appointment-notifications',
    recipientSteps: [
      'On a computer, sign in to Square Dashboard',
      'Go to Appointments → Settings → Notifications',
      chipStep('If you can add another email, paste ', ''),
      'If not, use the Forward email tab instead',
    ],
  },
  vagaro: {
    platform: 'vagaro',
    platformLabel: 'Vagaro',
    supportsDirectRecipient: 'yes',
    officialHelpUrl: 'https://support.vagaro.com/hc/en-us',
    recipientSteps: [
      'On a computer, sign in to Vagaro Pro',
      'Go to Settings → Business → Notifications',
      chipStep('Add ', ' to your notification emails'),
      'Confirm cancellation emails are on, then save',
    ],
  },
  fresha: {
    platform: 'fresha',
    platformLabel: 'Fresha',
    supportsDirectRecipient: 'yes',
    officialHelpUrl: 'https://www.fresha.com/help',
    recipientSteps: [
      'On a computer, sign in to Fresha for Business',
      'Go to Settings → Notifications',
      chipStep('Add ', ' for booking alert emails'),
      'Turn on cancellation notifications and save',
    ],
  },
  acuity: {
    platform: 'acuity',
    platformLabel: 'Acuity Scheduling',
    supportsDirectRecipient: 'yes',
    officialHelpUrl: 'https://help.acuityscheduling.com/hc/en-us/articles/219085908-Email-and-text-notifications',
    recipientSteps: [
      'On a computer, sign in to Acuity Scheduling',
      'Go to Business Settings → Notifications → Email',
      chipStep('Add ', ' under admin or additional notification emails'),
      'Turn on cancellation notifications and save',
    ],
  },
  glossgenius: {
    platform: 'glossgenius',
    platformLabel: 'GlossGenius',
    supportsDirectRecipient: 'limited',
    officialHelpUrl: 'https://glossgenius.elevio.help/en',
    recipientSteps: [
      'On a computer, sign in to GlossGenius',
      'Go to Settings → Notifications or Email alerts',
      chipStep('If you can add another email, paste ', ''),
      'If not, use the Forward email tab instead',
    ],
  },
  schedulicity: {
    platform: 'schedulicity',
    platformLabel: 'Schedulicity',
    supportsDirectRecipient: 'unknown',
    officialHelpUrl: 'https://support.schedulicity.com',
    recipientSteps: [
      'On a computer, sign in to Schedulicity',
      'Open account settings and find Email notifications or Alerts',
      chipStep('If you can add another email, paste ', ''),
      'If not, use the Forward email tab instead',
    ],
  },
  mangomint: {
    platform: 'mangomint',
    platformLabel: 'Mangomint',
    supportsDirectRecipient: 'unknown',
    officialHelpUrl: 'https://support.mangomint.com',
    recipientSteps: [
      'On a computer, sign in to Mangomint',
      'Go to Settings → Notifications or Email settings',
      chipStep('If you can add another email, paste ', ''),
      'If not, use the Forward email tab instead',
    ],
  },
  other: {
    platform: 'other',
    platformLabel: 'Other',
    supportsDirectRecipient: 'unknown',
    recipientSteps: [
      'On a computer, sign in to your booking platform',
      'Find Notifications, Email alerts, or Cancellation emails in settings',
      chipStep('If you can add another email, paste ', ''),
      'If not, use the Forward email tab instead',
    ],
  },
};

const FORWARDING_GUIDES: Record<EmailClientKind, EmailForwardingGuide> = {
  gmail: {
    client: 'gmail',
    label: 'Gmail',
    steps: [
      'On a computer, open Gmail in the inbox that gets cancellations',
      'Click the gear → See all settings → Forwarding and POP/IMAP',
      chipStep('Click "Add a forwarding address" and paste ', ''),
      'When Gmail asks to confirm, tap Verify below',
      'Optional: add a filter so only cancellations forward',
    ],
  },
  outlook: {
    client: 'outlook',
    label: 'Outlook',
    steps: [
      'On a computer, open Outlook on the web in that inbox',
      'Go to Settings → Mail → Forwarding',
      chipStep('Turn on forwarding to ', ''),
      'When the confirmation arrives, tap Verify below',
    ],
  },
  other: {
    client: 'other',
    label: 'Other email',
    steps: [
      'Open the inbox that receives cancellation emails from your booking platform',
      'Find Forwarding or Rules in your email settings',
      chipStep('Forward cancellations to ', ''),
      'When the confirmation arrives, tap Verify below',
    ],
  },
};

const GENERIC_GUIDE = PLATFORM_GUIDES.other;

export function isBookingSystemSlug(value: string | null | undefined): value is BookingSystemSlug {
  if (!value) return false;
  return BOOKING_SYSTEM_OPTIONS.some((option) => option.value === value);
}

export function getPlatformLabel(provider: string | null | undefined): string {
  if (!provider) return 'your booking platform';
  const guide = getEmailSyncGuide(provider);
  return guide.platformLabel;
}

export function getEmailSyncGuide(provider: string | null | undefined): EmailSyncPlatformGuide {
  if (isBookingSystemSlug(provider)) {
    return PLATFORM_GUIDES[provider];
  }
  return GENERIC_GUIDE;
}

export function getForwardingGuide(client: EmailClientKind): EmailForwardingGuide {
  return FORWARDING_GUIDES[client];
}

export function getAllEmailSyncPlatformGuides(): EmailSyncPlatformGuide[] {
  return BOOKING_SYSTEM_OPTIONS.map((option) => PLATFORM_GUIDES[option.value]);
}

export function getRecommendedEmailSyncPath(
  provider: string | null | undefined
): EmailSyncPathKind {
  const guide = getEmailSyncGuide(provider);
  return guide.supportsDirectRecipient === 'limited' ? 'email_forwarding' : 'platform_recipient';
}

export function getDefaultEmailSyncTab(
  provider: string | null | undefined
): EmailSyncPathKind {
  return getRecommendedEmailSyncPath(provider);
}

export const HELP_GUIDES_AUTO_OPENINGS_LABEL = 'Automatic openings setup';
