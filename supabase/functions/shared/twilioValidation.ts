/**
 * Twilio webhook signature validation utilities
 * Implements HMAC-SHA1 validation per Twilio's security requirements
 * https://www.twilio.com/docs/usage/security#validating-requests
 */

/**
 * Validate Twilio webhook signature
 * @param authToken - Twilio Auth Token (from env)
 * @param signature - X-Twilio-Signature header value
 * @param url - Full webhook URL including protocol
 * @param params - Request body parameters (form data as object)
 * @returns true if signature is valid
 */
export async function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): Promise<boolean> {
  try {
    // Build the data string: URL + sorted params concatenated
    const sortedKeys = Object.keys(params).sort();
    let data = url;
    for (const key of sortedKeys) {
      data += key + params[key];
    }

    // Compute HMAC-SHA1
    const encoder = new TextEncoder();
    const keyData = encoder.encode(authToken);
    const messageData = encoder.encode(data);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const signatureBytes = await crypto.subtle.sign('HMAC', key, messageData);
    
    // Convert to base64
    const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

    // Constant-time comparison to prevent timing attacks
    return secureCompare(computedSignature, signature);
  } catch (error) {
    console.error('[Twilio Validation] Error validating signature:', error);
    return false;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Extract and parse form data from a request for Twilio webhooks
 */
export async function parseTwilioFormData(req: Request): Promise<Record<string, string>> {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  
  formData.forEach((value, key) => {
    params[key] = value.toString();
  });
  
  return params;
}

/**
 * Build the webhook URL from request for signature validation
 * Note: For Edge Functions, we need to construct the full URL
 */
export function getWebhookUrl(req: Request): string {
  const url = new URL(req.url);
  // Return the full URL without query params (Twilio uses POST body)
  return `${url.protocol}//${url.host}${url.pathname}`;
}









