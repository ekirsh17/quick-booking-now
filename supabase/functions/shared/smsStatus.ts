/**
 * SMS Status mapping utilities
 * Maps Twilio delivery statuses to internal status enum
 */

/**
 * Internal SMS status enum
 * Simplified from Twilio's more granular statuses
 */
export type SmsStatus = 
  | 'queued'      // Message accepted, waiting to be sent
  | 'sending'     // Message is being sent
  | 'sent'        // Message sent to carrier
  | 'delivered'   // Confirmed delivered to recipient
  | 'failed'      // Message failed to send
  | 'undelivered' // Carrier could not deliver
  | 'unknown';    // Unrecognized status

/**
 * Twilio message statuses
 * @see https://www.twilio.com/docs/sms/api/message-resource#message-status-values
 */
export type TwilioMessageStatus = 
  | 'accepted'
  | 'scheduled'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'receiving'
  | 'received'
  | 'delivered'
  | 'undelivered'
  | 'failed'
  | 'read'
  | 'canceled';

/**
 * Map Twilio status to internal status
 */
export function mapTwilioStatus(twilioStatus: string): SmsStatus {
  const status = twilioStatus.toLowerCase();
  
  switch (status) {
    case 'accepted':
    case 'scheduled':
    case 'queued':
      return 'queued';
    
    case 'sending':
      return 'sending';
    
    case 'sent':
      return 'sent';
    
    case 'delivered':
    case 'read':
      return 'delivered';
    
    case 'failed':
    case 'canceled':
      return 'failed';
    
    case 'undelivered':
      return 'undelivered';
    
    // Inbound statuses (receiving, received) - shouldn't appear in outbound callbacks
    case 'receiving':
    case 'received':
      return 'delivered';
    
    default:
      console.warn(`[SMS Status] Unknown Twilio status: ${twilioStatus}`);
      return 'unknown';
  }
}

/**
 * Check if status indicates a terminal state (won't change further)
 */
export function isTerminalStatus(status: SmsStatus): boolean {
  return ['delivered', 'failed', 'undelivered'].includes(status);
}

/**
 * Check if status indicates a failure
 */
export function isFailureStatus(status: SmsStatus): boolean {
  return ['failed', 'undelivered'].includes(status);
}

/**
 * Get human-readable status label for UI display
 */
export function getStatusLabel(status: SmsStatus): string {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'sending':
      return 'Sending';
    case 'sent':
      return 'Sent';
    case 'delivered':
      return 'Delivered';
    case 'failed':
      return 'Failed';
    case 'undelivered':
      return 'Undelivered';
    case 'unknown':
    default:
      return 'Unknown';
  }
}

