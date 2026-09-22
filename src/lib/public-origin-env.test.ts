import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isVercelPreviewDeploymentHost,
  resolveConfiguredPublicOrigin,
} from "./public-origin-env.ts";
import { resolveDefaultX402Network } from "./x402-env.ts";

describe("resolveConfiguredPublicOrigin", () => {
  it("prefers explicit BASE_URL over VERCEL_URL preview hostname", () => {
    const origin = resolveConfiguredPublicOrigin({
      baseUrl: "https://x402-crediting-swarm.vercel.app",
      vercelUrl:
        "x402-crediting-swarm-oi7ld5isj-onyxlmunkeys-projects.vercel.app",
    });
    assert.equal(origin, "https://x402-crediting-swarm.vercel.app");
  });

  it("uses VERCEL_PROJECT_PRODUCTION_URL instead of deployment VERCEL_URL", () => {
    const origin = resolveConfiguredPublicOrigin({
      vercelProjectProductionUrl: "x402-crediting-swarm.vercel.app",
      vercelUrl:
        "x402-crediting-swarm-oi7ld5isj-onyxlmunkeys-projects.vercel.app",
    });
    assert.equal(origin, "https://x402-crediting-swarm.vercel.app");
  });

  it("skips preview VERCEL_URL when no production alias is configured", () => {
    const origin = resolveConfiguredPublicOrigin({
      vercelUrl:
        "x402-crediting-swarm-oi7ld5isj-onyxlmunkeys-projects.vercel.app",
    });
    assert.equal(origin, null);
  });
});

describe("isVercelPreviewDeploymentHost", () => {
  it("flags team deployment URLs", () => {
    assert.equal(
      isVercelPreviewDeploymentHost(
        "x402-crediting-swarm-oi7ld5isj-onyxlmunkeys-projects.vercel.app",
      ),
      true,
    );
    assert.equal(
      isVercelPreviewDeploymentHost("x402-crediting-swarm.vercel.app"),
      false,
    );
  });
});

describe("resolveDefaultX402Network", () => {
  it("defaults Vercel production to Base mainnet without CDP keys", () => {
    assert.equal(
      resolveDefaultX402Network({
        hasCdpCredentials: false,
        vercelEnv: "production",
        nodeEnv: "production",
      }),
      "eip155:8453",
    );
  });

  it("keeps Sepolia for Vercel preview when unset", () => {
    assert.equal(
      resolveDefaultX402Network({
        hasCdpCredentials: false,
        vercelEnv: "preview",
        nodeEnv: "production",
      }),
      "eip155:84532",
    );
  });
});
