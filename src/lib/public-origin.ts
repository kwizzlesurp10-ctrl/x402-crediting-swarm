import { NextRequest } from "next/server";

const PRIVATE_HOSTS = new Set([
  "0.0.0.0",
  "127.0.0.1",
  "localhost",
  "::",
  "::1",
]);

function stripSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function hostnameOf(host: string): string {
  const trimmed = host.trim().toLowerCase();
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    return end === -1 ? trimmed : trimmed.slice(1, end);
  }
  return trimmed.split(":")[0] ?? trimmed;
}

function isPrivateHost(host: string): boolean {
  const hostname = hostnameOf(host);
  if (PRIVATE_HOSTS.has(hostname)) return true;
  if (hostname.endsWith(".railway.internal")) return true;
  if (hostname.endsWith(".local")) return true;
  return false;
}

function firstHeader(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function originFromHost(host: string | null, proto: string): string | null {
  if (!host || isPrivateHost(host)) return null;
  const scheme = proto === "http" ? "http" : "https";
  return `${scheme}://${host}`;
}

/** Explicit deploy origin, or Railway's public domain. */
export function configuredPublicOrigin(): string | null {
  const explicit =
    process.env.PUBLIC_ORIGIN?.trim() || process.env.BASE_URL?.trim();
  if (explicit) return stripSlash(explicit);

  const railwayStatic = process.env.RAILWAY_STATIC_URL?.trim();
  if (railwayStatic) return stripSlash(railwayStatic);

  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railwayDomain && !isPrivateHost(railwayDomain)) {
    return `https://${stripSlash(railwayDomain)}`;
  }

  return null;
}

/**
 * Origin agents should see in OpenAPI `servers` and x402 `resource.url`.
 * Next standalone on Railway builds `req.url` from HOSTNAME=0.0.0.0 + PORT.
 */
export function publicOrigin(req: NextRequest): string {
  const configured = configuredPublicOrigin();
  if (configured) return configured;

  const proto =
    firstHeader(req.headers.get("x-forwarded-proto")) ||
    new URL(req.url).protocol.replace(":", "") ||
    "https";

  const forwarded = originFromHost(
    firstHeader(req.headers.get("x-forwarded-host")),
    proto,
  );
  if (forwarded) return forwarded;

  const host = originFromHost(firstHeader(req.headers.get("host")), proto);
  if (host) return host;

  const fallback = new URL(req.url).origin;
  if (!isPrivateHost(new URL(fallback).host)) return fallback;
  return fallback;
}

/** Clone the request so @x402/next advertises the public resource URL. */
export function rewriteRequestToPublicOrigin(req: NextRequest): NextRequest {
  const origin = publicOrigin(req);
  const current = new URL(req.url);
  const rewritten = new URL(`${current.pathname}${current.search}`, origin);
  if (rewritten.href === current.href) return req;
  return new NextRequest(rewritten, req);
}
