const DEFAULT_BILLING_API_URL = 'http://localhost:3001';
const DEFAULT_LOCAL_BILLING_API_URL = 'http://localhost:3001';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const getConfiguredBillingApiUrl = () => (
  trimTrailingSlash(import.meta.env.VITE_API_URL || DEFAULT_BILLING_API_URL)
);

export const resolveBillingApiUrl = () => {
  const configured = getConfiguredBillingApiUrl();
  if (typeof window === 'undefined') return configured;

  const hostname = window.location.hostname;
  const isLocalOrigin = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
  const isHostedApi = configured.includes('api.openalert.org');

  if (isLocalOrigin && isHostedApi) {
    return trimTrailingSlash(import.meta.env.VITE_LOCAL_API_URL || DEFAULT_LOCAL_BILLING_API_URL);
  }

  return configured;
};

const buildBillingApiCandidates = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const primaryBase = resolveBillingApiUrl();
  const configuredBase = getConfiguredBillingApiUrl();
  const candidates = [`${primaryBase}${normalizedPath}`];

  if (typeof window !== 'undefined' && primaryBase !== '') {
    candidates.push(normalizedPath);
  }

  if (configuredBase && configuredBase !== primaryBase) {
    candidates.push(`${configuredBase}${normalizedPath}`);
  }

  return [...new Set(candidates)];
};

export async function fetchBillingApi(path: string, init?: RequestInit): Promise<Response> {
  const candidates = buildBillingApiCandidates(path);
  let lastError: unknown;

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const isLast = index === candidates.length - 1;
    const isRelativeCandidate = candidate.startsWith('/');
    const isLocalHostCandidate = candidate.includes('localhost')
      || candidate.includes('127.0.0.1')
      || candidate.includes('0.0.0.0');

    try {
      const response = await fetch(candidate, init);
      const shouldRetry = !isLast && (
        response.status >= 500
        // Local dev often uses /api proxy. If proxy isn't configured, /api returns 404.
        // Keep falling back instead of hard-failing so we can hit the configured API URL.
        || ((isRelativeCandidate || isLocalHostCandidate) && response.status === 404)
      );
      if (shouldRetry) {
        console.warn('Billing API request returned retryable status, retrying fallback API URL.', {
          status: response.status,
          candidate,
          fallback: candidates[index + 1],
        });
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (!isLast) {
        console.warn('Billing API proxy request failed, retrying direct API URL.', {
          candidate,
          fallback: candidates[index + 1],
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to reach billing service.');
}
