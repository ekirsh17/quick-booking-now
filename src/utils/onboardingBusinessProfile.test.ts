import { describe, expect, it } from 'vitest';
import { getNextIncompleteBusinessProfileSection } from './onboardingBusinessProfile';

describe('getNextIncompleteBusinessProfileSection', () => {
  const completeSizing = {
    locationCount: '1',
    teamSize: 'solo',
    weeklyAppointments: '1-10',
    staffFirstName: 'Alex',
  };

  it('returns staff when sizing fields are complete but staff name is empty', () => {
    expect(
      getNextIncompleteBusinessProfileSection({
        ...completeSizing,
        staffFirstName: '',
      }),
    ).toBe('staff');
  });

  it('returns null only after staff first name is provided', () => {
    expect(getNextIncompleteBusinessProfileSection(completeSizing)).toBeNull();
  });

  it('treats whitespace-only staff names as incomplete', () => {
    expect(
      getNextIncompleteBusinessProfileSection({
        ...completeSizing,
        staffFirstName: '   ',
      }),
    ).toBe('staff');
  });

  it('walks through sections in order', () => {
    expect(
      getNextIncompleteBusinessProfileSection({
        locationCount: '',
        teamSize: '',
        weeklyAppointments: '',
        staffFirstName: '',
      }),
    ).toBe('location');

    expect(
      getNextIncompleteBusinessProfileSection({
        locationCount: '1',
        teamSize: '',
        weeklyAppointments: '',
        staffFirstName: '',
      }),
    ).toBe('team');

    expect(
      getNextIncompleteBusinessProfileSection({
        locationCount: '1',
        teamSize: 'solo',
        weeklyAppointments: '',
        staffFirstName: '',
      }),
    ).toBe('weekly');
  });
});
