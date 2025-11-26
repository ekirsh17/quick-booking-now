import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DiagnosticReport {
  timestamp: string;
  denoRuntime: {
    version: string;
    working: boolean;
  };
  environmentVariables: {
    TWILIO_ACCOUNT_SID: { present: boolean; length: number };
    TWILIO_AUTH_TOKEN: { present: boolean; length: number };
    TWILIO_PHONE_NUMBER: { present: boolean; value: string | null };
    USE_DIRECT_NUMBER: { present: boolean; value: string | null; parsed: boolean };
    TWILIO_MESSAGING_SERVICE_SID: { present: boolean; value: string | null };
    SUPABASE_URL: { present: boolean; value: string | null };
    SUPABASE_SERVICE_ROLE_KEY: { present: boolean; length: number };
    TESTING_MODE: { present: boolean; value: string | null; parsed: boolean };
  };
  configuration: {
    useDirectNumber: boolean;
    hasPhoneNumber: boolean;
    hasMessagingService: boolean;
    configurationValid: boolean;
    configurationError: string | null;
  };
  twilioConnectivity: {
    tested: boolean;
    success: boolean;
    error: string | null;
    responseTime?: number;
  };
  summary: {
    allRequiredVarsPresent: boolean;
    configurationReady: boolean;
    readyToSendSMS: boolean;
    issues: string[];
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const report: DiagnosticReport = {
    timestamp: new Date().toISOString(),
    denoRuntime: {
      version: Deno.version.deno,
      working: true,
    },
    environmentVariables: {
      TWILIO_ACCOUNT_SID: {
        present: !!Deno.env.get('TWILIO_ACCOUNT_SID'),
        length: Deno.env.get('TWILIO_ACCOUNT_SID')?.length || 0,
      },
      TWILIO_AUTH_TOKEN: {
        present: !!Deno.env.get('TWILIO_AUTH_TOKEN'),
        length: Deno.env.get('TWILIO_AUTH_TOKEN')?.length || 0,
      },
      TWILIO_PHONE_NUMBER: {
        present: !!Deno.env.get('TWILIO_PHONE_NUMBER'),
        value: Deno.env.get('TWILIO_PHONE_NUMBER') || null,
      },
      USE_DIRECT_NUMBER: {
        present: !!Deno.env.get('USE_DIRECT_NUMBER'),
        value: Deno.env.get('USE_DIRECT_NUMBER') || null,
        parsed: Deno.env.get('USE_DIRECT_NUMBER') === 'true',
      },
      TWILIO_MESSAGING_SERVICE_SID: {
        present: !!Deno.env.get('TWILIO_MESSAGING_SERVICE_SID'),
        value: Deno.env.get('TWILIO_MESSAGING_SERVICE_SID') || null,
      },
      SUPABASE_URL: {
        present: !!Deno.env.get('SUPABASE_URL'),
        value: Deno.env.get('SUPABASE_URL') || null,
      },
      SUPABASE_SERVICE_ROLE_KEY: {
        present: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        length: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.length || 0,
      },
      TESTING_MODE: {
        present: !!Deno.env.get('TESTING_MODE'),
        value: Deno.env.get('TESTING_MODE') || null,
        parsed: Deno.env.get('TESTING_MODE') === 'true',
      },
    },
    configuration: {
      useDirectNumber: Deno.env.get('USE_DIRECT_NUMBER') === 'true',
      hasPhoneNumber: !!Deno.env.get('TWILIO_PHONE_NUMBER'),
      hasMessagingService: !!Deno.env.get('TWILIO_MESSAGING_SERVICE_SID'),
      configurationValid: false,
      configurationError: null,
    },
    twilioConnectivity: {
      tested: false,
      success: false,
      error: null,
    },
    summary: {
      allRequiredVarsPresent: false,
      configurationReady: false,
      readyToSendSMS: false,
      issues: [],
    },
  };

  // Validate configuration
  const issues: string[] = [];
  
  if (!report.environmentVariables.TWILIO_ACCOUNT_SID.present) {
    issues.push('TWILIO_ACCOUNT_SID is missing');
  }
  
  if (!report.environmentVariables.TWILIO_AUTH_TOKEN.present) {
    issues.push('TWILIO_AUTH_TOKEN is missing');
  }

  if (report.configuration.useDirectNumber) {
    if (!report.configuration.hasPhoneNumber) {
      issues.push('USE_DIRECT_NUMBER is true but TWILIO_PHONE_NUMBER is missing');
      report.configuration.configurationError = 'USE_DIRECT_NUMBER requires TWILIO_PHONE_NUMBER';
    }
  } else {
    if (!report.configuration.hasMessagingService) {
      issues.push('USE_DIRECT_NUMBER is false but TWILIO_MESSAGING_SERVICE_SID is missing');
      report.configuration.configurationError = 'Either USE_DIRECT_NUMBER=true with TWILIO_PHONE_NUMBER, or USE_DIRECT_NUMBER=false with TWILIO_MESSAGING_SERVICE_SID';
    }
  }

  report.configuration.configurationValid = issues.length === 0;
  report.summary.issues = issues;
  report.summary.allRequiredVarsPresent = 
    report.environmentVariables.TWILIO_ACCOUNT_SID.present &&
    report.environmentVariables.TWILIO_AUTH_TOKEN.present &&
    ((report.configuration.useDirectNumber && report.configuration.hasPhoneNumber) ||
     (!report.configuration.useDirectNumber && report.configuration.hasMessagingService));

  report.summary.configurationReady = report.configuration.configurationValid;

  // Test Twilio connectivity if credentials are present
  if (report.environmentVariables.TWILIO_ACCOUNT_SID.present && 
      report.environmentVariables.TWILIO_AUTH_TOKEN.present) {
    try {
      const startTime = Date.now();
      const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
      const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')!;
      const auth = btoa(`${accountSid}:${authToken}`);
      
      // Test with a simple API call to get account info
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
          },
        }
      );
      
      const responseTime = Date.now() - startTime;
      report.twilioConnectivity.tested = true;
      report.twilioConnectivity.responseTime = responseTime;
      
      if (response.ok) {
        report.twilioConnectivity.success = true;
      } else {
        const errorText = await response.text();
        report.twilioConnectivity.success = false;
        report.twilioConnectivity.error = `HTTP ${response.status}: ${errorText.substring(0, 200)}`;
        issues.push(`Twilio API test failed: ${report.twilioConnectivity.error}`);
      }
    } catch (error: any) {
      report.twilioConnectivity.tested = true;
      report.twilioConnectivity.success = false;
      report.twilioConnectivity.error = error.message || 'Unknown error';
      issues.push(`Twilio connectivity test error: ${report.twilioConnectivity.error}`);
    }
  } else {
    report.twilioConnectivity.error = 'Cannot test: Twilio credentials missing';
    issues.push('Cannot test Twilio connectivity: credentials missing');
  }

  report.summary.issues = issues;
  report.summary.readyToSendSMS = 
    report.summary.allRequiredVarsPresent &&
    report.summary.configurationReady &&
    report.twilioConnectivity.success;

  return new Response(
    JSON.stringify(report, null, 2),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
};

serve(handler);



