export type BusinessProfileSizingSection = 'location' | 'team' | 'weekly' | 'staff';

export function getNextIncompleteBusinessProfileSection({
  locationCount,
  teamSize,
  weeklyAppointments,
  staffFirstName,
}: {
  locationCount: string;
  teamSize: string;
  weeklyAppointments: string;
  staffFirstName: string;
}): BusinessProfileSizingSection | null {
  if (!locationCount) return 'location';
  if (!teamSize) return 'team';
  if (!weeklyAppointments) return 'weekly';
  if (!staffFirstName.trim()) return 'staff';
  return null;
}
