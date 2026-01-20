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
  { value: '1_9', label: '1-9 appointments per week' },
  { value: '10_24', label: '10-24 appointments per week' },
  { value: '25_49', label: '25-49 appointments per week' },
  { value: '50_plus', label: '50+ appointments per week' },
] as const;

export const TEAM_SIZE_OPTIONS = [
  { value: 'solo', label: 'Just me' },
  { value: '2_4', label: '2-4 staff' },
  { value: '5_9', label: '5-9 staff' },
  { value: '10_plus', label: 'More than 10' },
] as const;

export const TEAM_SIZE_TO_SEATS: Record<string, number> = {
  solo: 1,
  '2_4': 4,
  '5_9': 9,
  '10_plus': 12,
};

export function getSeatCountForTeamSize(teamSize: string): number {
  return TEAM_SIZE_TO_SEATS[teamSize] || 1;
}
