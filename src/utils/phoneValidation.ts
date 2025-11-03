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
 * Validates phone number format (E.164: +[country][number])
 * @param phone - Phone number to validate
 * @returns Validation result with error message if invalid
 */
export function validatePhone(phone: string): PhoneValidationResult {
  // E.164 format regex: + followed by 1-15 digits
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  
  if (!phone) {
    return { 
      valid: false, 
      error: 'Phone number is required' 
    };
  }

  // Remove whitespace and common formatting
  const normalized = phone.trim().replace(/[\s\-\(\)]/g, '');
  
  if (!e164Regex.test(normalized)) {
    return { 
      valid: false, 
      error: 'Please enter a valid phone number with country code (e.g., +1 555-123-4567)' 
    };
  }
  
  return { 
    valid: true, 
    normalized 
  };
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
