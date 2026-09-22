const PRIVATE_HOSTS = new Set([
  "0.0.0.0",
  "127.0.0.1",
  "localhost",
  "::",
  "::1",
]);

export type PublicOriginEnv = {
  publicOrigin?: string;
  baseUrl?: string;
  vercelProjectProductionUrl?: string;
  vercelUrl?: string;
  railwayStaticUrl?: string;
  railwayPublicDomain?: string;
};

function stripSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function hostnameOf(host: string): string {
  const trimmed = host.trim().toLowerCase();
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    return end === -1 ? trimmed : trimmed.slice(1, end);
  }
  return trimmed.split(":")[0] ?? trimmed;
}

export function isPrivateHost(host: string): boolean {
  const hostname = hostnameOf(host);
  if (PRIVATE_HOSTS.has(hostname)) return true;
  if (hostname.endsWith(".railway.internal")) return true;
  if (hostname.endsWith(".local")) return true;
  return false;
}

function asHttpsOrigin(value: string): string {
  const stripped = stripSlash(value);
  if (/^https?:\/\//i.test(stripped)) return stripped;
  if (isPrivateHost(stripped)) return stripped;
  return `https://${stripped}`;
}

/** Vercel deployment URLs (not production aliases) must not be advertised in x402 catalogs. */
export function isVercelPreviewDeploymentHost(host: string): boolean {
  const hostname = hostnameOf(host);
  if (!hostname.endsWith(".vercel.app")) return false;
  if (hostname.endsWith("-projects.vercel.app")) return true;
  if (hostname.includes("-git-")) return true;
  return false;
}

export function originHostIsPublicStable(origin: string): boolean {
  try {
    const host = new URL(origin).host;
    if (isPrivateHost(host)) return false;
    if (isVercelPreviewDeploymentHost(host)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Explicit deploy origin from env (no request headers).
 * Prefers VERCEL_PROJECT_PRODUCTION_URL over VERCEL_URL so production catalogs
 * never leak per-deployment preview hostnames.
 */
export function resolveConfiguredPublicOrigin(
  env: PublicOriginEnv,
): string | null {
  const explicit = env.publicOrigin?.trim() || env.baseUrl?.trim();
  if (explicit) return asHttpsOrigin(explicit);

  const vercelProduction = env.vercelProjectProductionUrl?.trim();
  if (vercelProduction) return asHttpsOrigin(vercelProduction);

  const vercelUrl = env.vercelUrl?.trim();
  if (vercelUrl && !isVercelPreviewDeploymentHost(vercelUrl)) {
    return asHttpsOrigin(vercelUrl);
  }

  const railwayStatic = env.railwayStaticUrl?.trim();
  if (railwayStatic) return asHttpsOrigin(railwayStatic);

  const railwayDomain = env.railwayPublicDomain?.trim();
  if (railwayDomain && !isPrivateHost(railwayDomain)) {
    return asHttpsOrigin(railwayDomain);
  }

  return null;
}
