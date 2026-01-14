#!/usr/bin/env node

/**
 * Edge Function Configuration Validation Script
 * Validates edge function configuration by calling the health-check function
 * 
 * Usage: node scripts/validate-edge-function-config.js [--project-ref <ref>]
 * 
 * Requires:
 * - SUPABASE_URL environment variable or --project-ref flag
 * - SUPABASE_ACCESS_TOKEN or SUPABASE_SERVICE_ROLE_KEY for authentication
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get project configuration
function getProjectConfig() {
  const args = process.argv.slice(2);
  const projectRefIndex = args.indexOf('--project-ref');
  const projectRef = projectRefIndex >= 0 && args[projectRefIndex + 1] 
    ? args[projectRefIndex + 1]
    : null;

  // Try to get from environment or config
  const supabaseUrl = process.env.SUPABASE_URL || 
    (projectRef ? `https://${projectRef}.supabase.co` : null);
  
  const supabaseKey = process.env.SUPABASE_ACCESS_TOKEN || 
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    null;

  return { supabaseUrl, supabaseKey, projectRef };
}

async function validateEdgeFunctionConfig() {
  console.log('🔍 Validating Edge Function Configuration...\n');

  const { supabaseUrl, supabaseKey, projectRef } = getProjectConfig();

  if (!supabaseUrl) {
    console.error('❌ SUPABASE_URL not found!');
    console.log('   Set SUPABASE_URL environment variable or use --project-ref flag');
    console.log('   Example: SUPABASE_URL=https://your-project.supabase.co node scripts/validate-edge-function-config.js');
    console.log('   Or: node scripts/validate-edge-function-config.js --project-ref your-project-ref\n');
    process.exit(1);
  }

  if (!supabaseKey) {
    console.error('❌ SUPABASE_ACCESS_TOKEN or SUPABASE_SERVICE_ROLE_KEY not found!');
    console.log('   Set one of these environment variables for authentication');
    console.log('   SUPABASE_ACCESS_TOKEN can be obtained from: https://supabase.com/dashboard/account/tokens\n');
    process.exit(1);
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log(`📡 Calling health-check function at ${supabaseUrl}/functions/v1/health-check...\n`);
    
    const { data, error, status } = await supabase.functions.invoke('health-check', {
      body: {},
    });

    if (error) {
      console.error('❌ Error calling health-check function:');
      console.error(`   ${error.message}\n`);
      
      if (error.message.includes('Function not found')) {
        console.log('💡 Tip: Deploy the health-check function first:');
        console.log('   supabase functions deploy health-check\n');
      }
      
      process.exit(1);
    }

    if (!data) {
      console.error('❌ No data returned from health-check function\n');
      process.exit(1);
    }

    // Parse and display results
    const healthStatus = typeof data === 'string' ? JSON.parse(data) : data;
    
    console.log('📊 Health Check Results:\n');
    console.log(`Status: ${healthStatus.status.toUpperCase()}`);
    console.log(`Timestamp: ${healthStatus.timestamp}\n`);
    
    console.log('Summary:');
    console.log(`  Total checks: ${healthStatus.summary.total}`);
    console.log(`  Required: ${healthStatus.summary.required}`);
    console.log(`  Present: ${healthStatus.summary.present}`);
    console.log(`  Missing: ${healthStatus.summary.missing}\n`);

    // Display detailed checks
    const allChecks = [
      ...healthStatus.checks.supabase,
      ...healthStatus.checks.twilio,
      ...healthStatus.checks.notifications,
      ...healthStatus.checks.sms,
      ...healthStatus.checks.openai,
    ];

    const requiredChecks = allChecks.filter(c => c.required);
    const missingRequired = requiredChecks.filter(c => !c.present);

    if (missingRequired.length > 0) {
      console.log('❌ Missing Required Configuration:\n');
      missingRequired.forEach(check => {
        console.log(`  ${check.name}`);
        if (check.error) {
          console.log(`    Error: ${check.error}`);
        }
        console.log(`    Fix: Set in Supabase Dashboard > Edge Functions > Settings > Secrets\n`);
      });
    }

    const presentOptional = allChecks.filter(c => !c.required && c.present);
    if (presentOptional.length > 0) {
      console.log('✅ Optional Configuration Present:\n');
      presentOptional.forEach(check => {
        console.log(`  ${check.name}: ${check.value || 'set'}`);
      });
      console.log();
    }

    // Check for errors in configuration
    const checksWithErrors = allChecks.filter(c => c.error);
    if (checksWithErrors.length > 0) {
      console.log('⚠️  Configuration Warnings:\n');
      checksWithErrors.forEach(check => {
        console.log(`  ${check.name}: ${check.error}`);
      });
      console.log();
    }

    // Final status
    if (healthStatus.status === 'healthy') {
      console.log('✅ All required configuration is present!\n');
      process.exit(0);
    } else if (healthStatus.status === 'degraded') {
      console.log('⚠️  Configuration is degraded (some optional settings missing)\n');
      process.exit(0);
    } else {
      console.log('❌ Configuration is unhealthy (required settings missing)\n');
      console.log('💡 Fix missing configuration in Supabase Dashboard > Edge Functions > Settings > Secrets\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Validation failed:');
    console.error(`   ${error.message}\n`);
    
    if (error.message.includes('fetch')) {
      console.log('💡 Tip: Check your network connection and Supabase URL\n');
    }
    
    process.exit(1);
  }
}

// Run validation
validateEdgeFunctionConfig().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});





