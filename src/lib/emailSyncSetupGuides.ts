import { BOOKING_SYSTEM_OPTIONS } from '@/types/bookingSystems';

export type BookingSystemSlug = (typeof BOOKING_SYSTEM_OPTIONS)[number]['value'];
export type EmailSyncPathKind = 'platform_recipient' | 'email_forwarding';
export type DirectRecipientSupport = 'yes' | 'limited' | 'unknown';
export type EmailClientKind = 'gmail' | 'outlook' | 'other';

export const AUTO_OPENINGS_SETUP_TITLE = 'Automatically create openings';

export function getAutoOpeningsSetupSubtitle(platformLabel: string): string {
  return `When someone cancels on ${platformLabel}, we post an opening and text your waitlist`;
}

export interface EmailSyncPlatformGuide {
  platform: BookingSystemSlug;
  platformLabel: string;
  supportsDirectRecipient: DirectRecipientSupport;
  recipientSteps: string[];
  officialHelpUrl?: string;
}

export interface EmailForwardingGuide {
  client: EmailClientKind;
  label: string;
  steps: string[];
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
      'Sign in to Booksy Biz on a computer',
      'Open Settings → Notifications or Email notifications',
      'Add the address below as a cancellation notification recipient',
      'Save your changes',
    ],
  },
  setmore: {
    platform: 'setmore',
    platformLabel: 'Setmore',
    supportsDirectRecipient: 'yes',
    officialHelpUrl: 'https://support.setmore.com/en/collections/3460958-email-notifications',
    recipientSteps: [
      'Sign in to Setmore on a computer',
      'Go to Settings → Notifications',
      'Add the address below to emails that receive booking alerts',
      'Turn on cancellation notifications and save',
    ],
  },
  square: {
    platform: 'square',
    platformLabel: 'Square Appointments',
    supportsDirectRecipient: 'limited',
    officialHelpUrl: 'https://squareup.com/help/us/en/article/5072-set-up-appointment-notifications',
    recipientSteps: [
      'Sign in to Square Dashboard on a computer',
      'Go to Appointments → Settings → Notifications',
      'If you can add another email, paste the address below',
      'If not, use the Forward email tab instead',
    ],
  },
  vagaro: {
    platform: 'vagaro',
    platformLabel: 'Vagaro',
    supportsDirectRecipient: 'yes',
    officialHelpUrl: 'https://support.vagaro.com/hc/en-us',
    recipientSteps: [
      'Sign in to Vagaro Pro on a computer',
      'Open Settings → Business → Notifications',
      'Add the address below to your notification emails',
      'Confirm cancellation emails are on, then save',
    ],
  },
  fresha: {
    platform: 'fresha',
    platformLabel: 'Fresha',
    supportsDirectRecipient: 'yes',
    officialHelpUrl: 'https://www.fresha.com/help',
    recipientSteps: [
      'Sign in to Fresha for Business on a computer',
      'Open Settings → Notifications',
      'Add the address below for booking alert emails',
      'Turn on cancellation notifications and save',
    ],
  },
  acuity: {
    platform: 'acuity',
    platformLabel: 'Acuity Scheduling',
    supportsDirectRecipient: 'yes',
    officialHelpUrl: 'https://help.acuityscheduling.com/hc/en-us/articles/219085908-Email-and-text-notifications',
    recipientSteps: [
      'Sign in to Acuity Scheduling on a computer',
      'Go to Business Settings → Notifications → Email',
      'Add the address below under admin or additional notification emails',
      'Turn on cancellation notifications and save',
    ],
  },
  glossgenius: {
    platform: 'glossgenius',
    platformLabel: 'GlossGenius',
    supportsDirectRecipient: 'limited',
    officialHelpUrl: 'https://glossgenius.elevio.help/en',
    recipientSteps: [
      'Sign in to GlossGenius on a computer',
      'Open Settings → Notifications or Email alerts',
      'If you can add another email, paste the address below',
      'If not, use the Forward email tab instead',
    ],
  },
  schedulicity: {
    platform: 'schedulicity',
    platformLabel: 'Schedulicity',
    supportsDirectRecipient: 'unknown',
    officialHelpUrl: 'https://support.schedulicity.com',
    recipientSteps: [
      'Sign in to Schedulicity on a computer',
      'Open account settings and find Email notifications or Alerts',
      'If you can add another email, paste the address below',
      'If not, use the Forward email tab instead',
    ],
  },
  mangomint: {
    platform: 'mangomint',
    platformLabel: 'Mangomint',
    supportsDirectRecipient: 'unknown',
    officialHelpUrl: 'https://support.mangomint.com',
    recipientSteps: [
      'Sign in to Mangomint on a computer',
      'Open Settings → Notifications or Email settings',
      'If you can add another email, paste the address below',
      'If not, use the Forward email tab instead',
    ],
  },
  other: {
    platform: 'other',
    platformLabel: 'Other',
    supportsDirectRecipient: 'unknown',
    recipientSteps: [
      'Sign in to your booking platform on a computer',
      'Find Notifications, Email alerts, or Cancellation emails in settings',
      'If you can add another email, paste the address below',
      'If not, use the Forward email tab instead',
    ],
  },
};

const FORWARDING_GUIDES: Record<EmailClientKind, EmailForwardingGuide> = {
  gmail: {
    client: 'gmail',
    label: 'Gmail',
    steps: [
      'Sign in to Gmail with the inbox that gets cancellation emails',
      'Go to Settings → See all settings → Forwarding and POP/IMAP',
      'Add a forwarding address and paste the address below',
      'Complete forwarding verification on this page when the button appears',
      'Optional: filter so only cancellation emails forward',
    ],
  },
  outlook: {
    client: 'outlook',
    label: 'Outlook',
    steps: [
      'Sign in to Outlook on the web with the inbox that gets cancellations',
      'Open Settings → Mail → Forwarding or Rules',
      'Forward cancellation emails to the address below',
      'Complete forwarding verification on this page when the button appears',
    ],
  },
  other: {
    client: 'other',
    label: 'Other email',
    steps: [
      'Open the inbox that receives cancellation emails from your booking platform',
      'Find Forwarding or Rules in your email settings',
      'Forward cancellations to the address below',
      'Complete forwarding verification on this page when the button appears',
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

export function getDefaultEmailSyncTab(
  provider: string | null | undefined
): EmailSyncPathKind {
  const guide = getEmailSyncGuide(provider);
  return guide.supportsDirectRecipient === 'limited' ? 'email_forwarding' : 'platform_recipient';
}

export const HELP_GUIDES_AUTO_OPENINGS_LABEL = 'Automatic openings setup';
