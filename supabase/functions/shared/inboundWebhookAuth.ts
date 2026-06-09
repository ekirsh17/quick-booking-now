export type InboundWebhookAuthMode = 'off' | 'warn' | 'enforce';

export interface InboundWebhookAuthResult {
  allowed: boolean;
  mode: InboundWebhookAuthMode;
  status: number;
  reason:
    | 'mode_off'
    | 'auth_missing_config'
    | 'auth_valid'
    | 'auth_invalid'
    | 'auth_malformed_basic';
  details: {
    hasBasicConfig: boolean;
    hasSharedSecretConfig: boolean;
    sharedSecretHeaderName: string;
  };
}

const DEFAULT_SHARED_SECRET_HEADER = 'x-openalert-webhook-secret';

const resolveMode = (rawMode: string | undefined): InboundWebhookAuthMode => {
  const normalized = (rawMode || 'warn').trim().toLowerCase();
  if (normalized === 'off' || normalized === 'warn' || normalized === 'enforce') {
    return normalized;
  }
  return 'warn';
};

const secureCompare = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i++) {
    result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return result === 0;
};

const parseBasicAuth = (authHeader: string | null): { username: string; password: string } | null => {
  if (!authHeader) return null;
  const [scheme, encoded] = authHeader.split(' ');
  if (!scheme || !encoded || scheme.toLowerCase() !== 'basic') return null;
  try {
    const decoded = atob(encoded.trim());
    const separatorIdx = decoded.indexOf(':');
    if (separatorIdx <= 0) return null;
    return {
      username: decoded.slice(0, separatorIdx),
      password: decoded.slice(separatorIdx + 1),
    };
  } catch {
    return null;
  }
};

export const authenticateInboundWebhookRequest = (req: Request): InboundWebhookAuthResult => {
  const mode = resolveMode(Deno.env.get('INBOUND_WEBHOOK_AUTH_MODE'));
  if (mode === 'off') {
    return {
      allowed: true,
      mode,
      status: 200,
      reason: 'mode_off',
      details: {
        hasBasicConfig: false,
        hasSharedSecretConfig: false,
        sharedSecretHeaderName: DEFAULT_SHARED_SECRET_HEADER,
      },
    };
  }

  const basicUsername = (Deno.env.get('INBOUND_WEBHOOK_BASIC_USERNAME') || '').trim();
  const basicPassword = (Deno.env.get('INBOUND_WEBHOOK_BASIC_PASSWORD') || '').trim();
  const sharedSecret = (Deno.env.get('INBOUND_WEBHOOK_SHARED_SECRET') || '').trim();
  const sharedSecretHeaderName = (
    Deno.env.get('INBOUND_WEBHOOK_SHARED_SECRET_HEADER') || DEFAULT_SHARED_SECRET_HEADER
  )
    .trim()
    .toLowerCase();

  const hasBasicConfig = basicUsername.length > 0 && basicPassword.length > 0;
  const hasSharedSecretConfig = sharedSecret.length > 0;
  const hasAnyConfig = hasBasicConfig || hasSharedSecretConfig;

  const details = {
    hasBasicConfig,
    hasSharedSecretConfig,
    sharedSecretHeaderName,
  };

  if (!hasAnyConfig) {
    return {
      allowed: mode !== 'enforce',
      mode,
      status: mode === 'enforce' ? 500 : 200,
      reason: 'auth_missing_config',
      details,
    };
  }

  let basicValid = false;
  let malformedBasic = false;
  if (hasBasicConfig) {
    const basic = parseBasicAuth(req.headers.get('authorization'));
    malformedBasic = !basic;
    basicValid = Boolean(
      basic &&
        secureCompare(basic.username, basicUsername) &&
        secureCompare(basic.password, basicPassword),
    );
  }

  let sharedValid = false;
  if (hasSharedSecretConfig) {
    const provided = (req.headers.get(sharedSecretHeaderName) || '').trim();
    sharedValid = provided.length > 0 && secureCompare(provided, sharedSecret);
  }

  if (basicValid || sharedValid) {
    return {
      allowed: true,
      mode,
      status: 200,
      reason: 'auth_valid',
      details,
    };
  }

  return {
    allowed: mode !== 'enforce',
    mode,
    status: mode === 'enforce' ? 401 : 200,
    reason: malformedBasic ? 'auth_malformed_basic' : 'auth_invalid',
    details,
  };
};
