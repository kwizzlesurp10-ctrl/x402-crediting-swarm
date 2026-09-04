import "server-only";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import type { RouteConfig } from "@x402/core/server";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import {
  CDP_FACILITATOR_URL,
  buildCdpCreateAuthHeaders,
  hasCdpCredentials,
} from "@/lib/cdp-auth";

/** Same payTo used by x402-mcp on Base. Override with X402_PAY_TO_ADDRESS. */
export const DEFAULT_PAY_TO =
  "0x8A897D546c22d726b45Fa25F0EBB56207E63fF4e" as const;

export const EVAL_PRICE = process.env.X402_EVAL_PRICE ?? "$0.05";

const CDP = hasCdpCredentials();

export const X402_NETWORK = (process.env.X402_NETWORK ??
  (CDP ? "eip155:8453" : "eip155:84532")) as `${string}:${string}`;

export const X402_PAY_TO =
  process.env.X402_PAY_TO_ADDRESS ?? DEFAULT_PAY_TO;

/** PayAI public facilitator — Base mainnet without CDP keys. */
export const PAYAI_FACILITATOR_URL = "https://facilitator.payai.network";

const MAINNET = X402_NETWORK === "eip155:8453";

export const FACILITATOR_KIND: "cdp" | "payai" | "x402.org" = CDP
  ? "cdp"
  : MAINNET
    ? "payai"
    : "x402.org";

export const X402_FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL ??
  (CDP
    ? CDP_FACILITATOR_URL
    : MAINNET
      ? PAYAI_FACILITATOR_URL
      : "https://x402.org/facilitator");

export const SWARM_ROUTE_CONFIG: RouteConfig = {
  accepts: {
    scheme: "exact",
    price: EVAL_PRICE,
    network: X402_NETWORK,
    payTo: X402_PAY_TO,
    maxTimeoutSeconds: 300,
  },
  description:
    "x402 Crediting Swarm: 3-node GO/NO-GO threat intelligence report for a Payment Required payload",
  mimeType: "application/json",
  extensions: declareDiscoveryExtension({
    bodyType: "json",
    input: {
      caller_id: "agentcash",
      payload: {
        endpoint_url: "https://api.example/v1/resource",
        vendor_id: "vendor_crypto_993x",
      },
    },
    inputSchema: {
      type: "object",
      properties: {
        caller_id: { type: "string" },
        payload: {
          type: "object",
          properties: {
            endpoint_url: { type: "string" },
            vendor_id: { type: "string" },
            payTo: { type: "string" },
          },
          required: ["endpoint_url"],
        },
      },
      required: ["payload"],
    },
    output: {
      example: {
        status: "success",
        final_creditability_score: 820,
        final_recommendation: "GO",
      },
      schema: {
        type: "object",
        properties: {
          status: { type: "string" },
          final_creditability_score: { type: "integer" },
          final_recommendation: { type: "string" },
          trust_level: { type: "string" },
          aggregated_flags: { type: "array", items: { type: "string" } },
          node_reports: { type: "array" },
        },
        required: [
          "status",
          "final_creditability_score",
          "final_recommendation",
        ],
      },
    },
  }),
};

let server: x402ResourceServer | null = null;

export function getResourceServer(): x402ResourceServer {
  if (!server) {
    const facilitator = new HTTPFacilitatorClient({
      url: X402_FACILITATOR_URL,
      ...(CDP && process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET
        ? {
            createAuthHeaders: buildCdpCreateAuthHeaders(
              process.env.CDP_API_KEY_ID,
              process.env.CDP_API_KEY_SECRET,
              X402_FACILITATOR_URL,
            ),
          }
        : {}),
    });
    server = new x402ResourceServer(facilitator).register(
      X402_NETWORK,
      new ExactEvmScheme(),
    );
  }
  return server;
}

export function catalogEntry(resourceUrl: string) {
  return {
    resource: resourceUrl,
    type: "http",
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: X402_NETWORK,
        price: EVAL_PRICE,
        payTo: X402_PAY_TO,
      },
    ],
    description: SWARM_ROUTE_CONFIG.description,
    mimeType: "application/json",
  };
}
