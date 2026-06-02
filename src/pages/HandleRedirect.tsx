import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeHandleInput, validateMerchantHandle } from "@/lib/merchantHandle";
import { normalizeLocationShareSlug, validateLocationShareSlug } from "@/lib/locationShareSlug";
import { subtleAccentOutlineSelected } from "@/lib/interactiveHover";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ConsumerLayout } from "@/components/consumer/ConsumerLayout";

interface PublicLocationChoice {
  merchantId: string;
  businessName: string | null;
  locationId: string;
  locationName: string | null;
  locationAddress: string | null;
  locationSlug: string;
}

function formatLocationDisplayName(name: string | null): string {
  const trimmed = (name || "Location").trim();
  if (!trimmed) return "Location";
  if (trimmed === trimmed.toLowerCase()) {
    return trimmed.replace(/\b[a-z]/g, (char) => char.toUpperCase());
  }
  return trimmed;
}

function getLocationSecondaryLine(address: string | null): string | null {
  const trimmed = address?.trim();
  return trimmed ? trimmed : null;
}

interface LocationOptionRowProps {
  choice: PublicLocationChoice;
  selected: boolean;
  onSelect: () => void;
}

const LocationOptionRow = ({ choice, selected, onSelect }: LocationOptionRowProps) => {
  const displayName = formatLocationDisplayName(choice.locationName);
  const secondaryLine = getLocationSecondaryLine(choice.locationAddress);

  return (
    <Button
      type="button"
      role="radio"
      aria-checked={selected}
      variant="outline"
      onClick={onSelect}
      className={cn(
        "h-auto w-full flex-col items-start px-4 py-3 text-left font-normal",
        selected && subtleAccentOutlineSelected,
      )}
    >
      <span className="text-sm font-medium">{displayName}</span>
      {secondaryLine ? (
        <span className="mt-0.5 text-xs text-muted-foreground font-normal">{secondaryLine}</span>
      ) : null}
    </Button>
  );
};

const HandleRedirect = () => {
  const { handle: handleParam, locationSlug: locationSlugParam } = useParams<{ handle: string; locationSlug?: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [choices, setChoices] = useState<PublicLocationChoice[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<PublicLocationChoice | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  const businessName = useMemo(() => choices[0]?.businessName || "this business", [choices]);

  const sortedChoices = useMemo(() => {
    return [...choices].sort((a, b) => {
      const nameA = formatLocationDisplayName(a.locationName);
      const nameB = formatLocationDisplayName(b.locationName);
      const byName = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
      if (byName !== 0) return byName;
      return a.locationId.localeCompare(b.locationId);
    });
  }, [choices]);

  useEffect(() => {
    const handleRedirect = async () => {
      if (!handleParam) {
        navigate("/404");
        return;
      }

      const normalized = normalizeHandleInput(handleParam);
      const validation = validateMerchantHandle(normalized);
      if (!validation.ok) {
        navigate("/404");
        return;
      }

      if (locationSlugParam) {
        const normalizedLocationSlug = normalizeLocationShareSlug(locationSlugParam);
        const locationValidation = validateLocationShareSlug(normalizedLocationSlug);
        if (!locationValidation.ok) {
          navigate("/404");
          return;
        }

        const { data: resolvedRows, error: resolveError } = await supabase.rpc("resolve_public_handle_location", {
          p_handle: normalized,
          p_location_slug: normalizedLocationSlug,
        });

        if (resolveError || !resolvedRows || resolvedRows.length === 0) {
          navigate("/404");
          return;
        }

        const resolved = resolvedRows[0];
        navigate(`/notify/${resolved.merchant_id}/${resolved.location_id}`, { replace: true });
        return;
      }

      try {
        const { data: publicLocations, error } = await supabase.rpc("list_public_locations_for_handle", {
          p_handle: normalized,
        });

        if (error || !publicLocations || publicLocations.length === 0) {
          navigate("/404");
          return;
        }

        const normalizedChoices: PublicLocationChoice[] = publicLocations.map((row) => ({
          merchantId: row.merchant_id,
          businessName: row.business_name || null,
          locationId: row.location_id,
          locationName: row.location_name || null,
          locationAddress: row.location_address || null,
          locationSlug: row.location_slug,
        }));

        if (normalizedChoices.length === 1) {
          const only = normalizedChoices[0];
          navigate(`/notify/${only.merchantId}/${only.locationId}`, { replace: true });
          return;
        }

        setChoices(normalizedChoices);
        setIsLoading(false);
      } catch {
        navigate("/404");
      }
    };

    void handleRedirect();
  }, [handleParam, locationSlugParam, navigate]);

  const handleChooseLocation = (choice: PublicLocationChoice) => {
    setSelectedLocationId(choice.locationId);
    navigate(`/notify/${choice.merchantId}/${choice.locationId}`);
  };

  const handleContinue = () => {
    if (!selectedChoice || selectedLocationId) return;
    handleChooseLocation(selectedChoice);
  };

  const isNavigating = selectedLocationId !== null;

  if (isLoading) {
    return (
      <ConsumerLayout hideGuestSignInCta hideAccountControls hideHeader>
        <Card className="w-full p-8 text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Redirecting...</p>
        </Card>
      </ConsumerLayout>
    );
  }

  return (
    <ConsumerLayout businessName={businessName} hideGuestSignInCta hideAccountControls hideHeader>
      <Card className="w-full p-6 sm:p-7">
        <div className="mb-6 space-y-4">
          <div className="text-center">
            <p className="text-base font-semibold text-foreground">{businessName}</p>
            <h1 className="mt-2 text-2xl font-bold">Choose a location</h1>
            <p className="mt-1 text-muted-foreground">
              Select where you want to join the waitlist
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Location</Label>
            <div
              role="radiogroup"
              aria-label="Location"
              className={cn(
                "flex flex-col gap-2",
                sortedChoices.length >= 6 && "max-h-64 overflow-y-auto pr-1",
              )}
            >
              {sortedChoices.map((choice) => (
                <LocationOptionRow
                  key={choice.locationId}
                  choice={choice}
                  selected={selectedChoice?.locationId === choice.locationId}
                  onSelect={() => setSelectedChoice(choice)}
                />
              ))}
            </div>
          </div>

          <Button
            type="button"
            size="lg"
            className="w-full font-semibold"
            disabled={!selectedChoice || isNavigating}
            onClick={handleContinue}
          >
            {isNavigating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Opening...
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </div>
      </Card>
    </ConsumerLayout>
  );
};

export default HandleRedirect;
