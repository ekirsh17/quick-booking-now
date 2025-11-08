import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import QRCode from "https://esm.sh/qrcode@1.5.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { merchantId, customization } = await req.json();

    if (!merchantId) {
      throw new Error('merchantId is required');
    }

    console.log('Generating QR code for merchant:', merchantId);

    // Check if QR code already exists for this merchant
    const { data: existingQR } = await supabaseClient
      .from('qr_codes')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('is_active', true)
      .single();

    if (existingQR) {
      console.log('Returning existing QR code:', existingQR.short_code);
      return new Response(
        JSON.stringify({ qrCode: existingQR }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique short code
    let shortCode = generateShortCode();
    let attempts = 0;
    
    // Ensure uniqueness
    while (attempts < 10) {
      const { data: existing } = await supabaseClient
        .from('qr_codes')
        .select('id')
        .eq('short_code', shortCode)
        .single();
      
      if (!existing) break;
      shortCode = generateShortCode();
      attempts++;
    }

    console.log('Generated short code:', shortCode);

    // Build redirect URL
    const baseUrl = Deno.env.get('SUPABASE_URL') || '';
    const redirectUrl = `${baseUrl}/functions/v1/qr-redirect/${shortCode}`;

    // Generate QR code with customization
    const qrOptions = {
      width: customization?.width || 1000,
      margin: customization?.margin || 2,
      color: {
        dark: customization?.darkColor || '#000000',
        light: customization?.lightColor || '#FFFFFF',
      },
    };

    console.log('Generating QR code image for URL:', redirectUrl);
    const qrBuffer = await QRCode.toBuffer(redirectUrl, qrOptions);

    // Upload to storage
    const fileName = `${merchantId}/${shortCode}.png`;
    const { error: uploadError } = await supabaseClient
      .storage
      .from('qr-codes')
      .upload(fileName, qrBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    console.log('QR code uploaded to storage:', fileName);

    // Get public URL
    const { data: { publicUrl } } = supabaseClient
      .storage
      .from('qr-codes')
      .getPublicUrl(fileName);

    console.log('Public URL:', publicUrl);

    // Store in database
    const { data: qrCode, error: dbError } = await supabaseClient
      .from('qr_codes')
      .insert({
        merchant_id: merchantId,
        short_code: shortCode,
        image_url: publicUrl,
        customization,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

    console.log('QR code saved to database:', qrCode.id);

    return new Response(
      JSON.stringify({ qrCode }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating QR code:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => 
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}
