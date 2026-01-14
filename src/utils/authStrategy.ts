import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Determines authentication requirements based on context
 * OTP is only used for explicit consumer login, not notify/claim flows
 */
export type AuthStrategy = 'none' | 'otp_required' | 'otp_optional';

export interface AuthContext {
  flowType: 'notify' | 'claim';
  userType: 'new' | 'returning_guest' | 'authenticated';
  bookingCount?: number; // For claim flow
  requiresConfirmation?: boolean; // Merchant setting
}

export const determineAuthStrategy = (context: AuthContext): AuthStrategy => {
  const { flowType } = context;
  
  // NotifyMe flow: minimal friction
  if (flowType === 'notify') {
    return 'none'; // No OTP ever for notifications
  }
  
  // ClaimBooking flow: no OTP required
  if (flowType === 'claim') {
    return 'none';
  }
  
  return 'none';
};

// Helper to get user booking history
export const getUserBookingCount = async (
  phone: string, 
  supabase: SupabaseClient
): Promise<number> => {
  const { data, error } = await supabase
    .from('consumers')
    .select('booking_count')
    .eq('phone', phone)
    .maybeSingle();
  
  if (error) {
    console.error('Error fetching booking count:', error);
    return 0;
  }
  
  return data?.booking_count || 0;
};
