import { NextRequest } from "next/server";
import {
  hostnameOf,
  isPrivateHost,
  isVercelPreviewDeploymentHost,
  originHostIsPublicStable,
  resolveConfiguredPublicOrigin,
} from "@/lib/public-origin-env";

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

function readPublicOriginEnv() {
  return {
    publicOrigin: process.env.PUBLIC_ORIGIN,
    baseUrl: process.env.BASE_URL,
    vercelProjectProductionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    vercelUrl: process.env.VERCEL_URL,
    railwayStaticUrl: process.env.RAILWAY_STATIC_URL,
    railwayPublicDomain: process.env.RAILWAY_PUBLIC_DOMAIN,
  };
}

/** Explicit deploy origin, or Railway / Vercel production alias. */
export function configuredPublicOrigin(): string | null {
  return resolveConfiguredPublicOrigin(readPublicOriginEnv());
}

function requestPublicOrigin(req: NextRequest): string | null {
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

/**
 * Origin agents should see in OpenAPI `servers` and x402 `resource.url`.
 * Next standalone on Railway builds `req.url` from HOSTNAME=0.0.0.0 + PORT.
 */
export function publicOrigin(req: NextRequest): string {
  const configured = configuredPublicOrigin();
  const fromRequest = requestPublicOrigin(req);

  if (configured) {
    const configuredHost = hostnameOf(new URL(configured).host);
    const leaksPreview =
      isVercelPreviewDeploymentHost(configuredHost) ||
      !originHostIsPublicStable(configured);

    if (leaksPreview && fromRequest && originHostIsPublicStable(fromRequest)) {
      return fromRequest;
    }
    return configured;
  }

  if (fromRequest && originHostIsPublicStable(fromRequest)) {
    return fromRequest;
  }

  return fromRequest ?? "https://localhost";
}

/** Clone the request so @x402/next advertises the public resource URL. */
export function rewriteRequestToPublicOrigin(req: NextRequest): NextRequest {
  const origin = publicOrigin(req);
  const current = new URL(req.url);
  const rewritten = new URL(`${current.pathname}${current.search}`, origin);
  if (rewritten.href === current.href) return req;
  return new NextRequest(rewritten, req);
}
