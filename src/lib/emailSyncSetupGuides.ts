import { BOOKING_SYSTEM_OPTIONS } from '@/types/bookingSystems';

export type BookingSystemSlug = (typeof BOOKING_SYSTEM_OPTIONS)[number]['value'];
export type EmailSyncPathKind = 'platform_recipient' | 'email_forwarding';
export type DirectRecipientSupport = 'yes' | 'limited' | 'unknown';
export type EmailClientKind = 'gmail' | 'outlook' | 'yahoo' | 'icloud' | 'aol' | 'other';

export type EmailSyncStep = string;

export const AUTO_OPENINGS_SETUP_TITLE = 'Automatically create openings';
export const EMAIL_SYNC_PROVIDER_LABEL = 'Your email provider';
export const EMAIL_SYNC_EMPTY_PLATFORM_MESSAGE =
  'Pick your booking platform to see the exact steps';
export const EMAIL_SYNC_VERIFY_BUTTON_LABEL = 'Verify email';
export const EMAIL_SYNC_SETUP_ENABLE_LABEL = 'Turn on automatic openings';
export const EMAIL_SYNC_SETUP_CLOSE_LABEL = 'Close';
export const EMAIL_FORWARDING_TAB_LABEL = 'Set up email forwarding';
export const AUTO_OPENINGS_SETUP_SHEET_SUBTITLE_GENERIC =
  'Choose how you want to connect OpenAlert to your booking platform';
export const AUTO_OPENINGS_SETTINGS_SUBTITLE_GENERIC =
  'When a client cancels via your booking platform, OpenAlert creates an opening and texts your waitlist';

export function getAutoOpeningsSetupSubtitle(platformLabel: string): string {
  return `When a client cancels on ${platformLabel}, OpenAlert creates an opening and texts your waitlist`;
}

export function getAutoOpeningsSetupSheetSubtitle(
  platformProvider: string | null | undefined,
): string {
  if (!platformProvider) {
    return AUTO_OPENINGS_SETUP_SHEET_SUBTITLE_GENERIC;
  }
  return `Choose how you want to connect OpenAlert to ${getPlatformLabel(platformProvider)}`;
}

export function getAutoOpeningsSettingsSubtitle(platformProvider: string | null | undefined): string {
  if (!platformProvider) {
    return AUTO_OPENINGS_SETTINGS_SUBTITLE_GENERIC;
  }
  return getAutoOpeningsSetupSubtitle(getPlatformLabel(platformProvider));
}

export function getPlatformSetupTabLabel(platformLabel: string): string {
  return `Set up in ${platformLabel}`;
}

export function getPlatformPathIntro(platformLabel: string): string {
  return `Add the email below in ${platformLabel} to receive booking notifications`;
}

export function getForwardingPathIntro(_platformLabel: string): string {
  return 'Forward appointment emails from your booking platform';
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
  officialHelpUrl?: string;
}

export const EMAIL_CLIENT_OPTIONS: { value: EmailClientKind; label: string }[] = [
  { value: 'gmail', label: 'Gmail' },
  { value: 'outlook', label: 'Outlook' },
  { value: 'yahoo', label: 'Yahoo Mail' },
  { value: 'icloud', label: 'iCloud Mail' },
  { value: 'aol', label: 'AOL Mail' },
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
      'Add the email below as an email that gets appointment notifications',
      'Turn appointment notification emails on, then Save',
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
      'Add the email below to emails that receive booking alerts',
      'Turn on appointment notification emails and save',
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
      'If you can add another email, paste the email below',
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
      'Add the email below to your notification emails',
      'Confirm appointment notification emails are on, then save',
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
      'Add the email below for booking alert emails',
      'Turn on appointment notification emails and save',
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
      'Add the email below under admin or additional notification emails',
      'Turn on appointment notification emails and save',
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
      'If you can add another email, paste the email below',
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
      'If you can add another email, paste the email below',
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
      'If you can add another email, paste the email below',
      'If not, use the Forward email tab instead',
    ],
  },
  other: {
    platform: 'other',
    platformLabel: 'Other',
    supportsDirectRecipient: 'unknown',
    recipientSteps: [
      'On a computer, sign in to your booking platform',
      'Find Notifications, Email alerts, or Appointment emails in settings',
      'If you can add another email, paste the email below',
      'If not, use the Forward email tab instead',
    ],
  },
};

const FORWARDING_GUIDES: Record<EmailClientKind, EmailForwardingGuide> = {
  gmail: {
    client: 'gmail',
    label: 'Gmail',
    officialHelpUrl: 'https://support.google.com/mail/answer/10957',
    steps: [
      'On a computer, open Gmail in the inbox that gets appointment emails from your booking platform',
      'Click the gear → See all settings → Forwarding and POP/IMAP',
      'Click "Add a forwarding address" and paste the email below',
      'When Gmail asks to confirm, tap Verify',
      'Optional: add a filter so only appointment emails from your platform forward',
    ],
  },
  outlook: {
    client: 'outlook',
    label: 'Outlook',
    officialHelpUrl:
      'https://support.microsoft.com/en-us/office/turn-automatic-forwarding-on-or-off-90c812b1-f488-4e6f-a8a5-8a375db3d33c',
    steps: [
      'On a computer, open Outlook on the web in that inbox',
      'Go to Settings → Mail → Forwarding',
      'Turn on forwarding to the email below',
      'When the confirmation arrives, tap Verify',
    ],
  },
  yahoo: {
    client: 'yahoo',
    label: 'Yahoo Mail',
    officialHelpUrl:
      'https://help.yahoo.com/kb/new-yahoo-mail/enable-automatic-email-forwarding-yahoo-mail-sln36684.html',
    steps: [
      'On a computer, open Yahoo Mail in the inbox that gets appointment emails from your booking platform',
      'Auto-forwarding requires Yahoo Mail Plus on most accounts',
      'Click Settings → More Settings → Mailboxes → your primary mailbox',
      'Under Auto-forwarding, paste the email below and click Verify',
      'When Yahoo sends a confirmation, tap Verify',
    ],
  },
  icloud: {
    client: 'icloud',
    label: 'iCloud Mail',
    officialHelpUrl:
      'https://support.apple.com/guide/icloud/automatically-forward-email-mm6b1a3960/icloud',
    steps: [
      'On a computer, go to icloud.com/mail and sign in',
      'Click the gear → Settings → Mail Forwarding',
      'Check Forward my email to and paste the email below',
      'When the confirmation arrives, tap Verify',
    ],
  },
  aol: {
    client: 'aol',
    label: 'AOL Mail',
    officialHelpUrl: 'https://help.aol.com/articles/aol-mail-mail-settings',
    steps: [
      'On a computer, sign in to mail.aol.com',
      'Click Settings → More Settings → General',
      'If you see Forwarding, paste the email below and save — if not, AOL may not support auto-forward on your account',
      'When the confirmation arrives, tap Verify',
    ],
  },
  other: {
    client: 'other',
    label: 'Other email',
    steps: [
      'Open the inbox that receives appointment emails from your booking platform',
      'Find Forwarding or Rules in your email settings',
      'Forward appointment emails to the email below',
      'When the confirmation arrives, tap Verify',
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

export const HELP_GUIDES_AUTO_OPENINGS_LABEL = 'Automatic Openings';
