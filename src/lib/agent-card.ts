import { EVAL_PRICE, X402_NETWORK, X402_PAY_TO } from "./swarm-route-config.ts";

const A2A_X402_EXTENSION_URI =
  "https://github.com/google-agentic-commerce/a2a-x402/blob/main/spec/v0.2";

export type AgentCard = {
  name: string;
  description: string;
  url: string;
  version: string;
  protocolVersion: string;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
    stateTransitionHistory: boolean;
    extensions: Array<{
      uri: string;
      description: string;
      required: boolean;
      params?: Record<string, string>;
    }>;
  };
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
  }>;
};

export function buildAgentCard(origin: string): AgentCard {
  const swarmUrl = `${origin}/api/swarm`;
  return {
    name: "x402 Crediting Swarm",
    description:
      "HTTP x402 seller on Base mainnet that scores Payment Required payloads with a three-node consensus report (credit score 0–1000 and GO/NO-GO). Paid access is POST /api/swarm with JSON { payload }; payment is USDC via the CDP facilitator.",
    url: swarmUrl,
    version: "0.1.0",
    protocolVersion: "0.3.0",
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
      extensions: [
        {
          uri: A2A_X402_EXTENSION_URI,
          description:
            "Micropayment settlement with x402 v2 (exact scheme, USDC on Base).",
          required: true,
          params: {
            network: X402_NETWORK,
            asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913",
            payTo: X402_PAY_TO,
            price: EVAL_PRICE,
          },
        },
      ],
    },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    skills: [
      {
        id: "evaluate-x402-payload",
        name: "Evaluate x402 payment payload",
        description:
          `Paid POST ${swarmUrl} accepts JSON with a required payload object (x402 call and vendor metadata) and returns aggregated node reports. Unpaid calls receive HTTP 402 with a PAYMENT-REQUIRED header (${EVAL_PRICE} per evaluation).`,
        tags: ["x402", "threat-intelligence", "base", "swarm"],
        examples: [
          `POST ${swarmUrl} Content-Type: application/json body: {"payload":{"endpoint_url":"https://api.example/v1/resource"}}`,
        ],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
      },
    ],
  };
}
