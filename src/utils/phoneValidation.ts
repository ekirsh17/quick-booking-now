/**
 * Phone validation and formatting utilities
 */

/**
 * Formats a phone number to E.164 format (+1XXXXXXXXXX)
 * @param phoneNumber - The phone number to format
 * @returns Formatted phone number in E.164 format
 */
export const formatPhoneToE164 = (phoneNumber: string): string => {
  const digits = phoneNumber.replace(/\D/g, '');
  
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  return phoneNumber.startsWith('+') ? phoneNumber : `+1${digits}`;
};

/**
 * Validates a phone number format
 * @param phoneNumber - The phone number to validate
 * @returns Object with isValid boolean and optional error message
 */
export const validatePhone = (phoneNumber: string): { isValid: boolean; error?: string } => {
  if (!phoneNumber || phoneNumber.trim() === '') {
    return { isValid: false, error: 'Phone number is required' };
  }

  const digits = phoneNumber.replace(/\D/g, '');
  
  if (digits.length < 10) {
    return { isValid: false, error: 'Phone number must be at least 10 digits' };
  }
  
  if (digits.length > 15) {
    return { isValid: false, error: 'Phone number is too long' };
  }
  
  return { isValid: true };
};

/**
 * Formats a phone number for display (e.g., (555) 123-4567)
 * @param phoneNumber - The phone number to format
 * @returns Formatted phone number for display
 */
export const formatPhoneDisplay = (phoneNumber: string): string => {
  const digits = phoneNumber.replace(/\D/g, '');
  
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  
  return phoneNumber;
};
