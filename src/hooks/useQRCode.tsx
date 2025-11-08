import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface QRCodeData {
  id: string;
  merchant_id: string;
  short_code: string;
  image_url: string;
  scan_count: number;
  last_scanned_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface QRCodeStats {
  total_scans: number;
  mobile_scans: number;
  tablet_scans: number;
  desktop_scans: number;
  last_scanned_at: string | null;
}

export const useQRCode = (merchantId: string | undefined) => {
  const [qrCode, setQrCode] = useState<QRCodeData | null>(null);
  const [stats, setStats] = useState<QRCodeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQRCode = async () => {
    if (!merchantId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Try to fetch existing QR code
      const { data: existingQR, error: fetchError } = await supabase
        .from('qr_codes')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('is_active', true)
        .single();

      if (existingQR) {
        setQrCode(existingQR);
        await fetchStats(existingQR.id);
        setLoading(false);
        return;
      }

      // If no QR code exists, generate one
      console.log('No QR code found, generating new one...');
      const { data, error: generateError } = await supabase.functions.invoke('generate-merchant-qr', {
        body: { merchantId },
      });

      if (generateError) {
        throw new Error(generateError.message);
      }

      if (data?.qrCode) {
        setQrCode(data.qrCode);
        await fetchStats(data.qrCode.id);
      }
    } catch (err: any) {
      console.error('Error fetching/generating QR code:', err);
      setError(err.message || 'Failed to load QR code');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (qrCodeId: string) => {
    try {
      const { data: scans, error: scansError } = await supabase
        .from('qr_code_scans')
        .select('device_type, scanned_at')
        .eq('qr_code_id', qrCodeId);

      if (scansError) {
        console.error('Error fetching scan stats:', scansError);
        return;
      }

      const total_scans = scans?.length || 0;
      const mobile_scans = scans?.filter(s => s.device_type === 'mobile').length || 0;
      const tablet_scans = scans?.filter(s => s.device_type === 'tablet').length || 0;
      const desktop_scans = scans?.filter(s => s.device_type === 'desktop').length || 0;
      const last_scanned_at = scans && scans.length > 0 
        ? scans.sort((a, b) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime())[0].scanned_at
        : null;

      setStats({
        total_scans,
        mobile_scans,
        tablet_scans,
        desktop_scans,
        last_scanned_at,
      });
    } catch (err) {
      console.error('Error calculating stats:', err);
    }
  };

  const regenerateQRCode = async () => {
    if (!merchantId || !qrCode) return;

    try {
      setLoading(true);
      setError(null);

      // Deactivate old QR code
      await supabase
        .from('qr_codes')
        .update({ is_active: false })
        .eq('id', qrCode.id);

      // Generate new one
      const { data, error: generateError } = await supabase.functions.invoke('generate-merchant-qr', {
        body: { merchantId },
      });

      if (generateError) {
        throw new Error(generateError.message);
      }

      if (data?.qrCode) {
        setQrCode(data.qrCode);
        setStats({
          total_scans: 0,
          mobile_scans: 0,
          tablet_scans: 0,
          desktop_scans: 0,
          last_scanned_at: null,
        });
      }
    } catch (err: any) {
      console.error('Error regenerating QR code:', err);
      setError(err.message || 'Failed to regenerate QR code');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQRCode();
  }, [merchantId]);

  // Set up real-time subscription for scan updates
  useEffect(() => {
    if (!qrCode?.id) return;

    const channel = supabase
      .channel('qr_scans')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'qr_code_scans',
          filter: `qr_code_id=eq.${qrCode.id}`,
        },
        () => {
          fetchStats(qrCode.id);
          // Also refresh QR code to get updated scan_count
          fetchQRCode();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qrCode?.id]);

  return {
    qrCode,
    stats,
    loading,
    error,
    regenerateQRCode,
    refreshStats: () => qrCode && fetchStats(qrCode.id),
  };
};
