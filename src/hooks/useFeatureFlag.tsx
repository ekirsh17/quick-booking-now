import { FEATURES, FeatureFlag } from '@/config/features';

/**
 * Hook to check if a feature flag is enabled
 * 
 * TEMPORARY DEVELOPMENT FEATURE - Remove before production
 */
export function useFeatureFlag(flag: FeatureFlag): boolean {
  return FEATURES[flag];
}
