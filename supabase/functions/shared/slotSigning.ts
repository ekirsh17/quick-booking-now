/**
 * HMAC-based slot link signing utilities
 * Prevents tampering with booking deep links
 */

export interface SlotLinkParams {
  slotId: string;
  startsAtUtc: string; // ISO8601
  durationMin: number;
  locationTz: string;
}

/**
 * Generate HMAC signature for slot parameters
 */
export async function generateSlotSignature(params: SlotLinkParams): Promise<string> {
  const secret = Deno.env.get('SLOT_LINK_SIGNING_SECRET');
  if (!secret) {
    throw new Error('SLOT_LINK_SIGNING_SECRET not configured');
  }

  const payload = `${params.slotId}.${params.startsAtUtc}.${params.durationMin}`;
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  
  // Convert to base64url
  const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Verify HMAC signature for slot parameters
 */
export async function verifySlotSignature(
  params: SlotLinkParams,
  signature: string
): Promise<boolean> {
  try {
    const expectedSig = await generateSlotSignature(params);
    return expectedSig === signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Build complete signed booking URL
 */
export function buildBookingUrl(
  baseUrl: string,
  merchantId: string,
  params: SlotLinkParams,
  signature: string
): string {
  const url = new URL(`${baseUrl}/claim/${params.slotId}`);
  url.searchParams.set('st', params.startsAtUtc);
  url.searchParams.set('tz', params.locationTz);
  url.searchParams.set('dur', params.durationMin.toString());
  url.searchParams.set('sig', signature);
  url.searchParams.set('mid', merchantId);
  
  return url.toString();
}
