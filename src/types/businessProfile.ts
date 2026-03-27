export const BUSINESS_TYPE_OPTIONS = [
  { value: 'barber_shop', label: 'Barber shop' },
  { value: 'hair_salon', label: 'Hair salon' },
  { value: 'nail_salon', label: 'Nail salon' },
  { value: 'spa', label: 'Spa' },
  { value: 'massage_therapy', label: 'Massage therapy' },
  { value: 'beauty_salon', label: 'Beauty salon' },
  { value: 'brows_lashes', label: 'Brows & lashes' },
  { value: 'skincare', label: 'Skincare / esthetics' },
  { value: 'tattoo_studio', label: 'Tattoo studio' },
  { value: 'med_spa', label: 'Med spa' },
  { value: 'personal_trainer', label: 'Personal trainer' },
  { value: 'fitness_gym', label: 'Gym / fitness studio' },
  { value: 'yoga', label: 'Yoga / pilates' },
  { value: 'chiropractor', label: 'Chiropractic' },
  { value: 'dental', label: 'Dental' },
  { value: 'medical', label: 'Medical clinic' },
  { value: 'counseling', label: 'Counseling / therapy' },
  { value: 'photography', label: 'Photography' },
  { value: 'pet_services', label: 'Pet services' },
  { value: 'education', label: 'Education / tutoring' },
  { value: 'home_services', label: 'Home services' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'legal', label: 'Legal services' },
  { value: 'real_estate', label: 'Real estate' },
  { value: 'bridal', label: 'Bridal / wedding' },
  { value: 'tour_booking', label: 'Tour booking' },
  { value: 'other', label: 'Other' },
] as const;

export const WEEKLY_APPOINTMENT_OPTIONS = [
  { value: 'just_starting', label: 'Just starting out' },
  { value: '1_9', label: '1-9' },
  { value: '10_24', label: '10-24' },
  { value: '25_49', label: '25-49' },
  { value: '50_99', label: '50-99' },
  { value: '100_plus', label: '100+' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

export const LOCATION_COUNT_OPTIONS = [
  { value: '1', label: '1 location' },
  { value: '2_3', label: '2-3 locations' },
  { value: '4_9', label: '4-9 locations' },
  { value: '10_plus', label: '10+ locations' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

export const TEAM_SIZE_OPTIONS = [
  { value: 'solo', label: 'Just me' },
  { value: '2_4', label: '2-4 staff' },
  { value: '5_9', label: '5-9 staff' },
  { value: '10_19', label: '10-19 staff' },
  { value: '20_plus', label: '20+ staff' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

export const TEAM_SIZE_TO_SEATS: Record<string, number> = {
  solo: 1,
  '2_4': 3,
  '5_9': 7,
  '10_19': 15,
  '20_plus': 20,
  not_sure: 2,
};

export function normalizeTeamSize(teamSize: string | null | undefined): string {
  if (!teamSize) return '';
  if (teamSize === '10_plus') return '10_19';
  return TEAM_SIZE_TO_SEATS[teamSize] ? teamSize : '';
}

export function normalizeWeeklyAppointments(weeklyAppointments: string | null | undefined): string {
  if (!weeklyAppointments) return '';
  if (weeklyAppointments === '50_plus') return '50_99';
  const validValues = new Set(WEEKLY_APPOINTMENT_OPTIONS.map((option) => option.value));
  return validValues.has(weeklyAppointments as (typeof WEEKLY_APPOINTMENT_OPTIONS)[number]['value'])
    ? weeklyAppointments
    : '';
}

export function normalizeLocationCount(locationCount: string | null | undefined): string {
  if (!locationCount) return '';
  const validValues = new Set(LOCATION_COUNT_OPTIONS.map((option) => option.value));
  return validValues.has(locationCount as (typeof LOCATION_COUNT_OPTIONS)[number]['value'])
    ? locationCount
    : '';
}

export function getSeatCountForTeamSize(teamSize: string): number {
  return TEAM_SIZE_TO_SEATS[teamSize] || 1;
}
