/**
 * Centralized phone number normalization utility
 * Ensures all phone numbers are normalized to E.164 format: +[country][number]
 * E.164 format is required by Twilio, database queries, and prevents mismatches
 */

/**
 * Normalize phone number to E.164 format (+[country][number])
 * Handles various input formats and converts them to standard E.164
 * 
 * @param phone - Phone number in any format (string, null, or undefined)
 * @returns Normalized E.164 format phone number (e.g., "+15165879844")
 * @throws Error if phone cannot be normalized to valid E.164 format
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
  // This handles edge cases but may fail validation
  const normalized = `+${cleaned}`;
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  
  if (e164Regex.test(normalized)) {
    return normalized;
  }
  
  throw new Error(`Cannot normalize phone number "${phone}" to E.164 format. Received: ${cleaned.length} digits`);
}

/**
 * Validate if a phone number is in E.164 format
 * @param phone - Phone number to validate
 * @returns true if phone is valid E.164 format
 */
export function isValidE164(phone: string): boolean {
  if (!phone) return false;
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone.trim());
}




