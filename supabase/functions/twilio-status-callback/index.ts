import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse Twilio status callback payload
    const formData = await req.formData();
    const MessageSid = formData.get('MessageSid')?.toString();
    const MessageStatus = formData.get('MessageStatus')?.toString();
    const ErrorCode = formData.get('ErrorCode')?.toString();
    const ErrorMessage = formData.get('ErrorMessage')?.toString();

    console.log('Twilio status callback:', { MessageSid, MessageStatus, ErrorCode });

    if (!MessageSid || !MessageStatus) {
      return new Response('Invalid callback payload', { status: 400 });
    }

    // Update SMS log with delivery status
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { error } = await supabase
      .from('sms_logs')
      .update({
        status: MessageStatus,
        error_code: ErrorCode || null,
        error_message: ErrorMessage || null,
        updated_at: new Date().toISOString(),
      })
      .eq('message_sid', MessageSid);

    if (error) {
      console.error('Failed to update SMS log:', error);
      throw error;
    }

    console.log(`Updated SMS log for ${MessageSid}: ${MessageStatus}`);

    return new Response('OK', { 
      status: 200,
      headers: corsHeaders 
    });
  } catch (error: any) {
    console.error('Error in twilio-status-callback:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
