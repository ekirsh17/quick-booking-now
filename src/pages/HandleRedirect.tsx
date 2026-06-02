import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeHandleInput, validateMerchantHandle } from "@/lib/merchantHandle";
import { normalizeLocationShareSlug, validateLocationShareSlug } from "@/lib/locationShareSlug";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PublicLocationChoice {
  merchantId: string;
  businessName: string | null;
  locationId: string;
  locationName: string | null;
  locationAddress: string | null;
  locationSlug: string;
}

const HandleRedirect = () => {
  const { handle: handleParam, locationSlug: locationSlugParam } = useParams<{ handle: string; locationSlug?: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [choices, setChoices] = useState<PublicLocationChoice[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  const businessName = useMemo(() => choices[0]?.businessName || "this business", [choices]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">Choose a location</h1>
          <p className="text-sm text-muted-foreground">
            {businessName} has multiple locations.
          </p>
        </div>
        <div className="space-y-3">
          {choices.map((choice) => (
            <Card key={choice.locationId} className="p-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="font-semibold">{choice.locationName || "Location"}</p>
                  {choice.locationAddress ? (
                    <p className="text-sm text-muted-foreground">{choice.locationAddress}</p>
                  ) : null}
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleChooseLocation(choice)}
                  disabled={selectedLocationId === choice.locationId}
                >
                  {selectedLocationId === choice.locationId ? "Opening..." : "Continue"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HandleRedirect;
