import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

const QRRedirect = () => {
  const { shortCode } = useParams<{ shortCode: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const handleRedirect = async () => {
      if (!shortCode) {
        navigate('/404');
        return;
      }

      try {
        // Look up QR code
        const { data: qrCode, error: qrError } = await supabase
          .from('qr_codes')
          .select('merchant_id, id, location_id')
          .eq('short_code', shortCode)
          .eq('is_active', true)
          .single();

        if (qrError || !qrCode) {
          console.error('QR code not found:', shortCode, qrError);
          navigate('/404');
          return;
        }

        // Detect device type
        const ua = navigator.userAgent.toLowerCase();
        let deviceType = 'desktop';
        if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
          deviceType = 'mobile';
        } else if (/tablet|ipad/i.test(ua)) {
          deviceType = 'tablet';
        }

        // Track scan (don't block on this)
        supabase.from('qr_code_scans').insert({
          qr_code_id: qrCode.id,
          device_type: deviceType,
          user_agent: navigator.userAgent,
          referrer: document.referrer || null,
        }).then(({ error }) => {
          if (error) console.error('Error tracking scan:', error);
        });

        // Increment scan count (don't block on this)
        supabase.rpc('increment_qr_scan_count', { 
          qr_id: qrCode.id 
        }).then(({ error }) => {
          if (error) console.error('Error incrementing scan count:', error);
        });

        // Redirect to notification page (location-specific when available)
        const notifyPath = qrCode.location_id
          ? `/notify/${qrCode.merchant_id}/${qrCode.location_id}`
          : `/notify/${qrCode.merchant_id}`;

        navigate(notifyPath);
      } catch (error) {
        console.error('Error in QR redirect:', error);
        navigate('/404');
      }
    };

    handleRedirect();
  }, [shortCode, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
};

export default QRRedirect;
