/**
 * Phone number validation utility
 * Ensures all phone numbers are in E.164 format: +[country][number]
 * E.164 format is required by Twilio and prevents SMS delivery failures
 */

export interface PhoneValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string;
}

/**
 * Normalize phone number to E.164 format (+[country][number])
 * Matches backend normalization logic for consistency
 * @param phone - Phone number in any format
 * @returns Normalized E.164 format phone number
 * @throws Error if phone cannot be normalized
 */
export function normalizePhoneToE164(phone: string | null | undefined): string {
  if (!phone) {
    throw new Error('Phone number is required');
  }
  
  // Remove all non-digit characters except +
  const cleaned = phone.trim().replace(/[^\d+]/g, '');
  
  if (!cleaned || cleaned.length < 10) {
    throw new Error('Phone number must contain at least 10 digits');
  }
  
  // If already in E.164 format (starts with +), validate and return
  if (cleaned.startsWith('+')) {
    // Validate E.164 format: + followed by 1-15 digits
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (e164Regex.test(cleaned)) {
      return cleaned;
    } else {
      throw new Error(`Invalid E.164 format: ${cleaned}. Must be + followed by 1-15 digits starting with 1-9`);
    }
  }
  
  // If it's 11 digits starting with 1 (US with country code), add +
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  
  // If it's 10 digits, assume US and add +1
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  
  // For other lengths, try to add + prefix and validate
  const normalized = `+${cleaned}`;
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  
  if (e164Regex.test(normalized)) {
    return normalized;
  }
  
  throw new Error(`Cannot normalize phone number "${phone}" to E.164 format. Received: ${cleaned.length} digits`);
}

/**
 * Validates phone number format (E.164: +[country][number])
 * Uses normalization logic that matches the backend
 * @param phone - Phone number to validate
 * @returns Validation result with error message if invalid
 */
export function validatePhone(phone: string): PhoneValidationResult {
  if (!phone) {
    return { 
      valid: false, 
      error: 'Phone number is required' 
    };
  }

  try {
    const normalized = normalizePhoneToE164(phone);
    return { 
      valid: true, 
      normalized 
    };
  } catch (error: any) {
    return { 
      valid: false, 
      error: error.message || 'Phone number must include country code (e.g., +1 555-123-4567)'
    };
  }
}

/**
 * Formats phone number for display (US format)
 * @param phone - E.164 formatted phone number
 * @returns Formatted phone number (e.g., +1 (212) 555-1234)
 */
export function formatPhoneForDisplay(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  // US phone number format
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.substring(1, 4)}) ${cleaned.substring(4, 7)}-${cleaned.substring(7)}`;
  }
  
  // Return as-is if not US format
  return phone;
}
