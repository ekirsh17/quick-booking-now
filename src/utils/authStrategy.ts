import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Determines authentication requirements based on context
 * Implements risk-adaptive 2FA strategy
 */
export type AuthStrategy = 'none' | 'otp_required' | 'otp_optional';

export interface AuthContext {
  flowType: 'notify' | 'claim';
  userType: 'new' | 'returning_guest' | 'authenticated';
  bookingCount?: number; // For claim flow
  requiresConfirmation?: boolean; // Merchant setting
}

export const determineAuthStrategy = (context: AuthContext): AuthStrategy => {
  const { flowType, userType, bookingCount = 0, requiresConfirmation = false } = context;
  
  // NotifyMe flow: minimal friction
  if (flowType === 'notify') {
    return 'none'; // No OTP ever for notifications
  }
  
  // ClaimBooking flow: risk-adaptive
  if (flowType === 'claim') {
    // Authenticated users never need OTP
    if (userType === 'authenticated') {
      return 'none';
    }
    
    // New users: no OTP on first booking
    if (userType === 'new' || bookingCount === 0) {
      return requiresConfirmation ? 'otp_optional' : 'none';
    }
    
    // Returning guests with 2+ bookings: require OTP
    if (userType === 'returning_guest' && bookingCount >= 1) {
      return 'otp_required';
    }
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
