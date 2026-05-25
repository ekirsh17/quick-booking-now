import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeHandleInput, validateMerchantHandle } from "@/lib/merchantHandle";

const HandleRedirect = () => {
  const { handle: handleParam } = useParams<{ handle: string }>();
  const navigate = useNavigate();

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

      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id")
          .eq("handle", normalized)
          .maybeSingle();

        if (error || !profile) {
          navigate("/404");
          return;
        }

        navigate(`/notify/${profile.id}`);
      } catch {
        navigate("/404");
      }
    };

    void handleRedirect();
  }, [handleParam, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
};

export default HandleRedirect;
