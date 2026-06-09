export const extractBearerToken = (req: Request): string | null => {
  const authHeader = req.headers.get('authorization') || '';
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = bearerMatch?.[1]?.trim();
  return token || null;
};

export const isInternalServiceRoleCaller = (
  req: Request,
  serviceRoleKey: string,
): boolean => {
  if (!serviceRoleKey) return false;

  const bearerToken = extractBearerToken(req);
  const apiKeyHeader = (req.headers.get('apikey') || '').trim();

  return bearerToken === serviceRoleKey || apiKeyHeader === serviceRoleKey;
};
