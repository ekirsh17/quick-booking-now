/// <reference types="vite/client" />

/**
 * Environment variable type definitions for Vite
 * These types ensure type safety when accessing import.meta.env variables
 */

interface ImportMetaEnv {
  /** Supabase project URL */
  readonly VITE_SUPABASE_URL: string;
  
  /** Supabase anon/public key (publishable key) */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  
  /** Supabase project ID */
  readonly VITE_SUPABASE_PROJECT_ID: string;
  
  /** Backend API server URL (optional, defaults to http://localhost:3001) */
  readonly VITE_API_URL?: string;
  
  /** Stripe publishable key for frontend (optional, for billing) */
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  
  /** PayPal client ID for frontend (optional, for billing) */
  readonly VITE_PAYPAL_CLIENT_ID?: string;
  
  /** Enable admin panel (optional, dev only, never true in production) */
  readonly VITE_ENABLE_ADMIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}






