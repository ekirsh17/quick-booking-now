export interface TriggerNotifyConsumersResult {
  success: boolean;
  notified?: number;
  error?: string;
}

/**
 * Invokes notify-consumers for a newly created slot. Never throws — callers
 * should treat opening creation as successful even when notifications fail.
 */
export async function triggerNotifyConsumers(
  slotId: string,
  merchantId: string,
): Promise<TriggerNotifyConsumersResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    const error = 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY';
    console.error('[triggerNotifyConsumers]', error);
    return { success: false, error };
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/notify-consumers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
      },
      body: JSON.stringify({ slotId, merchantId }),
    });

    let data: Record<string, unknown> = {};
    try {
      data = await response.json();
    } catch {
      // non-JSON response
    }

    if (!response.ok) {
      const error =
        (typeof data.error === 'string' && data.error) ||
        `notify-consumers HTTP ${response.status}`;
      console.error('[triggerNotifyConsumers] Request failed:', error);
      return { success: false, error };
    }

    if (data.success === false) {
      const error = typeof data.error === 'string' ? data.error : 'notify-consumers returned success: false';
      console.error('[triggerNotifyConsumers] Function error:', error);
      return { success: false, error };
    }

    const notified = typeof data.notified === 'number' ? data.notified : 0;
    return { success: true, notified };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[triggerNotifyConsumers] Exception:', error);
    return { success: false, error };
  }
}
