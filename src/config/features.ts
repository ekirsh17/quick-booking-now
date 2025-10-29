/**
 * Feature Flags Configuration
 * 
 * TEMPORARY FEATURES FOR DEVELOPMENT - REMOVE BEFORE PRODUCTION
 * 
 * To disable all dev features for production:
 * 1. Set all flags to false in this file
 * 2. Or create .env.production with VITE_DEV_MODE=false
 * 3. Or delete this entire file and all references to it
 */

export const FEATURES = {
  // Admin panel for testing and development - REMOVE IN PRODUCTION
  ADMIN_PANEL: import.meta.env.VITE_ADMIN_PANEL === 'true' || import.meta.env.DEV,
  
  // Show mock/sample data indicators
  MOCK_DATA: import.meta.env.VITE_MOCK_DATA === 'true' || import.meta.env.DEV,
  
  // Debug mode indicator
  DEBUG_MODE: import.meta.env.VITE_DEBUG_MODE === 'true' || import.meta.env.DEV,
} as const;

export type FeatureFlag = keyof typeof FEATURES;
