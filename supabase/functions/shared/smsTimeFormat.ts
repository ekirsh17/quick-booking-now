export const SMS_TIMEZONE_FALLBACK = "America/New_York";

type SupabaseQueryBuilder = {
  eq: (column: string, value: string) => SupabaseQueryBuilder;
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
};

type SupabaseLikeClient = {
  from: (table: string) => {
    select: (columns: string) => SupabaseQueryBuilder;
  };
};

type ResolveOperationalTimeZoneArgs = {
  supabase: SupabaseLikeClient;
  merchantId: string;
  locationId?: string | null;
  fallbackTimeZone?: string;
};

type FormatSlotArgs = {
  startIso: string;
  endIso: string;
  timeZone: string;
};

function normalizeTimeZone(rawTimeZone: string | null | undefined): string | null {
  if (!rawTimeZone) return null;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: rawTimeZone }).format(new Date());
    return rawTimeZone;
  } catch {
    return null;
  }
}

function getFormatter(
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    ...options,
  });
}

export async function resolveOperationalTimeZone({
  supabase,
  merchantId,
  locationId,
  fallbackTimeZone = SMS_TIMEZONE_FALLBACK,
}: ResolveOperationalTimeZoneArgs): Promise<string> {
  const safeFallback = normalizeTimeZone(fallbackTimeZone) || SMS_TIMEZONE_FALLBACK;

  if (locationId) {
    const { data: location, error: locationError } = await supabase
      .from("locations")
      .select("time_zone")
      .eq("id", locationId)
      .eq("merchant_id", merchantId)
      .maybeSingle();

    if (locationError) {
      console.warn("[sms-time-format] Failed location timezone lookup", {
        merchantId,
        locationId,
        error: locationError.message,
      });
    } else {
      const locationTimeZone = normalizeTimeZone((location?.time_zone as string | null | undefined) || null);
      if (locationTimeZone) return locationTimeZone;
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("time_zone")
    .eq("id", merchantId)
    .maybeSingle();

  if (profileError) {
    console.warn("[sms-time-format] Failed profile timezone lookup", {
      merchantId,
      error: profileError.message,
    });
    return safeFallback;
  }

  return normalizeTimeZone((profile?.time_zone as string | null | undefined) || null) || safeFallback;
}

export function formatSlotDateAndTimeRange({
  startIso,
  endIso,
  timeZone,
}: FormatSlotArgs): { dateLabel: string; timeRangeLabel: string } {
  const start = new Date(startIso);
  const end = new Date(endIso);

  const dateLabel = getFormatter(timeZone, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(start);

  const startTimeLabel = getFormatter(timeZone, {
    hour: "numeric",
    minute: "2-digit",
  }).format(start);

  const endTimeLabel = getFormatter(timeZone, {
    hour: "numeric",
    minute: "2-digit",
  }).format(end);

  return {
    dateLabel,
    timeRangeLabel: `${startTimeLabel} - ${endTimeLabel}`,
  };
}

export function formatSlotTimeRangeOnly({
  startIso,
  endIso,
  timeZone,
}: FormatSlotArgs): string {
  const { timeRangeLabel } = formatSlotDateAndTimeRange({
    startIso,
    endIso,
    timeZone,
  });
  return timeRangeLabel;
}
