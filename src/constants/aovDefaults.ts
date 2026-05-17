export type AovSource = 'user_set' | 'industry_default' | 'fallback';

export const FALLBACK_AOV = 70;

const INDUSTRY_AOV_DEFAULTS: Record<string, number> = {
  barber_shop: 55,
  hair_salon: 95,
  nail_salon: 65,
  spa: 120,
  massage_therapy: 110,
  beauty_salon: 90,
  brows_lashes: 80,
  skincare: 100,
  tattoo_studio: 150,
  med_spa: 180,
  personal_trainer: 85,
  fitness_gym: 50,
  yoga: 45,
  chiropractor: 110,
  dental: 180,
  medical: 140,
  counseling: 130,
  photography: 250,
  pet_services: 75,
  education: 70,
  home_services: 150,
  automotive: 220,
  consulting: 175,
  legal: 275,
  real_estate: 300,
  bridal: 220,
  tour_booking: 95,
};

export function getIndustryAovDefault(businessType: string | null | undefined): number | null {
  if (!businessType || businessType === 'other') {
    return null;
  }

  return INDUSTRY_AOV_DEFAULTS[businessType] ?? null;
}
