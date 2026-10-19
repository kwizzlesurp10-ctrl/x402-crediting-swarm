import { EVAL_PRICE, X402_NETWORK, X402_PAY_TO } from "./swarm-route-config.ts";

export const A2A_X402_EXTENSION_URI =
  "https://github.com/google-agentic-commerce/a2a-x402/blob/main/spec/v0.2";
export const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
/** /a2a speaks A2A 0.3 JSON-RPC wire shapes. */
export const A2A_INTERFACE_PROTOCOL_VERSION = "0.3";

/** "$0.05" → "50000" (USDC, 6 decimals). */
export function priceToAtomic(price: string): string {
  const n = Number(String(price).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? String(Math.round(n * 1_000_000)) : "0";
}

export type AgentSkillX402 = {
  paid: boolean;
  price: string;
  amount: string;
  currency: "USD";
  scheme: "exact";
  x402Version: 2;
  network: string;
  asset: string;
  assetSymbol: "USDC";
  payTo: string;
  maxTimeoutSeconds: number;
  endpoint: { method: "POST"; url: string };
  a2a: { url: string; skillId: string };
  catalog: string;
};

export type AgentCard = {
  name: string;
  description: string;
  url: string;
  preferredTransport: "JSONRPC";
  additionalInterfaces: Array<{ url: string; transport: string }>;
  supportedInterfaces: Array<{ url: string; protocolBinding: string; protocolVersion: string }>;
  version: string;
  protocolVersion: string;
  provider: { organization: string; url: string };
  documentationUrl: string;
  links: Record<string, string>;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
    stateTransitionHistory: boolean;
    extensions: Array<{
      uri: string;
      description: string;
      required: boolean;
      params?: Record<string, string | number>;
    }>;
  };
  securitySchemes: Record<string, { type: "apiKey"; in: "header"; name: string; description: string }>;
  security: Array<Record<string, string[]>>;
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: Array<{
    id: string;
    name: string;
    description: string;
    tags: string[];
    examples: string[];
    inputModes: string[];
    outputModes: string[];
    security: Array<Record<string, string[]>>;
    x402: AgentSkillX402;
  }>;
};

export function buildAgentCard(origin: string): AgentCard {
  const swarmUrl = `${origin}/api/swarm`;
  const a2aUrl = `${origin}/a2a`;
  const catalog = `${origin}/.well-known/x402`;
  const asset = X402_NETWORK === "eip155:84532" ? BASE_SEPOLIA_USDC : BASE_USDC;
  const exampleInput = { payload: { endpoint_url: "https://api.example/v1/resource" } };
  return {
    name: "x402 Crediting Swarm",
    description:
      `Scores an x402 Payment Required payload and vendor metadata with a three-node consensus report (credit score 0–1000 and GO/NO-GO) before an agent pays. ` +
      `${EVAL_PRICE} USDC per evaluation on ${X402_NETWORK} via x402 v2 (CDP facilitator), payTo ${X402_PAY_TO}. ` +
      `A2A JSON-RPC at ${a2aUrl}; HTTP at POST ${swarmUrl}.`,
    url: a2aUrl,
    preferredTransport: "JSONRPC",
    additionalInterfaces: [{ url: a2aUrl, transport: "JSONRPC" }],
    supportedInterfaces: [
      { url: a2aUrl, protocolBinding: "JSONRPC", protocolVersion: A2A_INTERFACE_PROTOCOL_VERSION },
    ],
    version: "0.1.0",
    protocolVersion: `${A2A_INTERFACE_PROTOCOL_VERSION}.0`,
    provider: {
      organization: "SEVTECH",
      url: "https://github.com/kwizzlesurp10-ctrl/x402-crediting-swarm",
    },
    documentationUrl: `${origin}/llms.txt`,
    links: {
      a2a: a2aUrl,
      x402: catalog,
      agentCard: `${origin}/.well-known/agent-card.json`,
      openapi: `${origin}/openapi.json`,
      llms: `${origin}/llms.txt`,
      mcpManifest: `${origin}/.well-known/mcp.json`,
      funding: `${origin}/.well-known/funding.json`,
    },
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
      extensions: [
        {
          uri: A2A_X402_EXTENSION_URI,
          description:
            "Micropayment settlement with x402 v2 (exact scheme, USDC on Base). Unpaid message/send returns input-required with x402.payment.required.",
          // Not required: free discovery (agent card, GET /a2a) works without it.
          required: false,
          params: {
            x402Version: 2,
            scheme: "exact",
            network: X402_NETWORK,
            asset,
            assetSymbol: "USDC",
            payTo: X402_PAY_TO,
            price: EVAL_PRICE,
            catalog,
          },
        },
      ],
    },
    securitySchemes: {
      x402: {
        type: "apiKey",
        in: "header",
        name: "PAYMENT-SIGNATURE",
        description:
          "x402 v2 payment payload (base64 JSON) on POST /api/swarm; over A2A send it as message.metadata[\"x402.payment.payload\"].",
      },
    },
    security: [{ x402: [] }],
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    skills: [
      {
        id: "evaluate-x402-payload",
        name: "Evaluate x402 payment payload",
        description:
          `Paid three-node GO/NO-GO credit report (score 0–1000, flags, trust level) for an x402 call and its vendor metadata. ` +
          `${EVAL_PRICE} USDC per evaluation on ${X402_NETWORK}. HTTP: POST ${swarmUrl} with JSON {payload:{endpoint_url,…}}; ` +
          `unpaid requests get HTTP 402 with PAYMENT-REQUIRED, a body without payload gets 400.`,
        tags: ["x402", "threat-intelligence", "credit-score", "fraud", "base", "usdc", "swarm"],
        examples: [
          "Should my agent pay this x402 endpoint? Score https://api.example/v1/resource",
          `POST ${swarmUrl} Content-Type: application/json body: ${JSON.stringify(exampleInput)}`,
          `A2A: POST ${a2aUrl} message/send with message.metadata={"skillId":"evaluate-x402-payload","input":${JSON.stringify(exampleInput)}}`,
        ],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
        security: [{ x402: [] }],
        x402: {
          paid: true,
          price: EVAL_PRICE,
          amount: priceToAtomic(EVAL_PRICE),
          currency: "USD",
          scheme: "exact",
          x402Version: 2,
          network: X402_NETWORK,
          asset,
          assetSymbol: "USDC",
          payTo: X402_PAY_TO,
          maxTimeoutSeconds: 300,
          endpoint: { method: "POST", url: swarmUrl },
          a2a: { url: a2aUrl, skillId: "evaluate-x402-payload" },
          catalog,
        },
      },
    ],
  };
}
