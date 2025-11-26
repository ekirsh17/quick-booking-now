// Onboarding types and constants

export type OnboardingStep = 1 | 2 | 3 | 4;

export interface OnboardingState {
  currentStep: OnboardingStep;
  timezone: string;
  appointmentTypes: string[];
  durations: { label: string; minutes: number }[];
  isComplete: boolean;
  isLoading: boolean;
}

export interface OnboardingActions {
  nextStep: () => void;
  prevStep: () => void;
  setTimezone: (timezone: string) => void;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
}

// Timezone options for US
export const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (No DST)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
] as const;

// Default appointment type presets
export const DEFAULT_APPOINTMENT_TYPES = [
  'Consultation',
  'Follow-up',
  'New Client',
  'Existing Client',
];

// Default duration presets
export const DEFAULT_DURATIONS = [
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: '1.5h', minutes: 90 },
  { label: '2h', minutes: 120 },
];

// Onboarding step titles
export const STEP_TITLES: Record<OnboardingStep, string> = {
  1: 'Welcome',
  2: 'Timezone',
  3: 'Services',
  4: 'Complete',
};

// Detect browser timezone
export function detectBrowserTimezone(): string {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Check if detected timezone is in our list
    const match = TIMEZONE_OPTIONS.find(tz => tz.value === detected);
    return match ? detected : 'America/New_York'; // Default to Eastern if not found
  } catch {
    return 'America/New_York';
  }
}


