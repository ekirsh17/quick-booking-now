import { supabase } from '@/integrations/supabase/client';

export interface MerchantConsumerLinks {
  handle: string | null;
  primaryLocationId: string | null;
  primaryLocationShareSlug: string | null;
}

export async function fetchMerchantConsumerLinks(merchantId: string): Promise<MerchantConsumerLinks> {
  const [{ data: profile, error: profileError }, { data: locations, error: locationError }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('handle, default_location_id')
        .eq('id', merchantId)
        .maybeSingle(),
      supabase
        .from('locations')
        .select('id, share_slug')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: true }),
    ]);

  if (profileError) {
    console.error('[adminConsumerLinks] Failed to load profile:', profileError);
  }
  if (locationError) {
    console.error('[adminConsumerLinks] Failed to load locations:', locationError);
  }

  const handle = profile?.handle ?? null;
  const defaultLocationId = profile?.default_location_id ?? null;
  const locationRows = locations ?? [];

  const defaultLocation =
    defaultLocationId != null
      ? locationRows.find((row) => row.id === defaultLocationId)
      : undefined;
  const withShareSlug = locationRows.find((row) => row.share_slug);
  const primary = defaultLocation ?? withShareSlug ?? locationRows[0];

  return {
    handle,
    primaryLocationId: primary?.id ?? null,
    primaryLocationShareSlug: primary?.share_slug ?? null,
  };
}

/** Canonical public waitlist URL for admin Notify Me CTA. */
export function buildNotifyMePath(links: MerchantConsumerLinks, merchantId: string): string | null {
  if (links.handle && links.primaryLocationShareSlug) {
    return `/${links.handle}/${links.primaryLocationShareSlug}`;
  }
  if (links.handle) {
    return `/${links.handle}`;
  }
  if (links.primaryLocationId) {
    return `/notify/${merchantId}/${links.primaryLocationId}`;
  }
  return null;
}

/** Public location chooser URL for admin Location selector CTA. */
export function buildLocationSelectorPath(links: MerchantConsumerLinks): string | null {
  if (links.handle) {
    return `/${links.handle}`;
  }
  return null;
}
