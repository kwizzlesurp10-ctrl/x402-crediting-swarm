import type { RouteConfig } from "@x402/core/server";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import type {
  DeclareBodyDiscoveryExtensionConfig,
  DeclareDiscoveryExtensionInput,
} from "@x402/extensions/bazaar";
import { resolveDefaultX402Network } from "./x402-env.ts";

/** Same payTo used by x402-mcp on Base. Override with X402_PAY_TO_ADDRESS. */
export const DEFAULT_PAY_TO =
  "0x05e1720bB82F86B5bc7940a99FDC702E32256357" as const;

export const EVAL_PRICE = process.env.X402_EVAL_PRICE ?? "$0.05";

const HAS_CDP_CREDENTIALS = Boolean(
  process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET,
);

export const X402_NETWORK = resolveDefaultX402Network({
  x402Network: process.env.X402_NETWORK,
  hasCdpCredentials: HAS_CDP_CREDENTIALS,
  vercelEnv: process.env.VERCEL_ENV,
  nodeEnv: process.env.NODE_ENV,
});

export const X402_PAY_TO =
  process.env.X402_PAY_TO_ADDRESS ?? DEFAULT_PAY_TO;

const SWARM_BAZAAR_BODY_EXAMPLE = {
  payload: {
    endpoint_url: "https://api.example/v1/resource",
    vendor_id: "vendor_crypto_993x",
    payTo: X402_PAY_TO,
    requested_amount_sats: 500,
    vendor_history: {
      fulfillment_rate: 0.97,
      dispute_ratio: 0.02,
    },
  },
} as const;

const SWARM_BAZAAR_DISCOVERY: DeclareBodyDiscoveryExtensionConfig = {
  method: "POST",
  bodyType: "json",
  input: SWARM_BAZAAR_BODY_EXAMPLE,
  inputSchema: {
    type: "object",
    properties: {
      caller_id: {
        type: "string",
        description: "Optional caller identifier for AgentMail alerts",
      },
      payload: {
        type: "object",
        description:
          "x402 Payment Required call details and vendor metadata to score",
        properties: {
          endpoint_url: {
            type: "string",
            description: "HTTPS resource URL from the x402 catalog entry",
          },
          vendor_id: { type: "string" },
          payTo: { type: "string", description: "Observed payTo on the 402" },
          requested_amount_sats: { type: "number" },
          vendor_history: {
            type: "object",
            properties: {
              fulfillment_rate: { type: "number" },
              dispute_ratio: { type: "number" },
            },
          },
        },
        required: ["endpoint_url"],
        additionalProperties: true,
      },
    },
    required: ["payload"],
    additionalProperties: false,
  },
  output: {
    example: {
      status: "success",
      caller_id: "agentcash",
      final_creditability_score: 820,
      final_recommendation: "GO",
      trust_level: "High Trust (Safe to auto-pay)",
      aggregated_flags: [],
      node_reports: [
        {
          node: "x402_node_alpha",
          score: 830,
          recommendation: "GO",
          flags: [],
          trust_level: "High Trust (Safe to auto-pay)",
        },
      ],
    },
    schema: {
      type: "object",
      properties: {
        status: { type: "string" },
        caller_id: { type: "string" },
        final_creditability_score: { type: "integer" },
        final_recommendation: { type: "string" },
        trust_level: { type: "string" },
        aggregated_flags: { type: "array", items: { type: "string" } },
        node_reports: { type: "array" },
        agentcash_intel: { type: "object" },
      },
      required: [
        "status",
        "final_creditability_score",
        "final_recommendation",
      ],
    },
  },
};

export const SWARM_ROUTE_CONFIG: RouteConfig = {
  accepts: {
    scheme: "exact",
    price: EVAL_PRICE,
    network: X402_NETWORK,
    payTo: X402_PAY_TO,
    maxTimeoutSeconds: 300,
  },
  serviceName: "x402 Crediting Swarm",
  tags: ["x402", "threat-intel", "base", "swarm"],
  description:
    "Three-node GO/NO-GO threat intelligence report for an x402 Payment Required payload and vendor metadata on Base mainnet (eip155:8453). $0.05 USDC per POST via the CDP facilitator. Unpaid requests return HTTP 402 with PAYMENT-REQUIRED; a JSON body without a payload object returns 400; payment settlement failures return 402.",
  mimeType: "application/json",
  extensions: declareDiscoveryExtension(
    SWARM_BAZAAR_DISCOVERY as DeclareDiscoveryExtensionInput,
  ),
};
