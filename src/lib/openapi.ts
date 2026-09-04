import { EVAL_PRICE, X402_NETWORK, X402_PAY_TO } from "@/lib/x402";

function decimalUsd(price: string): string {
  return Number(price.replace(/[^0-9.]/g, "") || "0").toFixed(6);
}

const GUIDANCE = `x402 Crediting Swarm scores a Payment Required call before an agent pays it.

Workflow:
1. GET /api/swarm — free catalog (price, network, payTo).
2. POST /api/swarm with JSON { caller_id?, payload }. Unpaid probes return HTTP 402 with a PAYMENT-REQUIRED header (x402 v2). Do not expect a JSON challenge body.
3. Retry the same JSON body with a signed PAYMENT-SIGNATURE (AgentCash: npx agentcash fetch <origin>/api/swarm -m POST -b '...' --payment-network base --payment-protocol x402).
4. On 200, read final_recommendation (GO / NO-GO / NO-GO (Caution)) and final_creditability_score (0-1000).

payload.endpoint_url is the vendor resource to score. Optional payload.payTo / payload.vendor_history improve the report. The swarm may spend operator AgentCash USDC on live SYNTHORA/market-intel probes; if that wallet is empty, flags include insufficient_balance instead of invented Bazaar facts.

Do not send fee_paid. Payment is protocol-gated, not a client boolean.`;

export function buildOpenApiDocument(origin: string) {
  const amount = decimalUsd(EVAL_PRICE);
  return {
    openapi: "3.1.0",
    info: {
      title: "x402 Crediting Swarm",
      version: "1.0.0",
      description:
        "3-node swarm that scores x402 Payment Required calls and returns a GO/NO-GO credit recommendation.",
      "x-guidance": GUIDANCE,
      contact: {
        name: "DragonandPanda / Sevtech",
        email: "kwizzlesurp10@gmail.com",
        url: origin,
      },
    },
    servers: [{ url: origin, description: "This origin" }],
    tags: [
      { name: "Catalog", description: "Free discovery" },
      { name: "Evaluation", description: "Paid swarm scoring" },
    ],
    paths: {
      "/api/swarm": {
        get: {
          operationId: "getSwarmCatalog",
          summary: "Free catalog for the paid evaluation resource",
          tags: ["Catalog"],
          security: [],
          responses: {
            "200": {
              description: "Catalog: price, network, payTo, body schema",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Catalog" },
                },
              },
            },
          },
        },
        post: {
          operationId: "evaluateX402Payload",
          summary:
            "Score an x402 Payment Required payload (3-node GO/NO-GO credit report)",
          tags: ["Evaluation"],
          "x-payment-info": {
            price: { mode: "fixed", currency: "USD", amount },
            protocols: [{ x402: {} }],
          },
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EvaluateRequest" },
                example: {
                  caller_id: "agentcash",
                  payload: {
                    endpoint_url:
                      "https://api.decentralized-catalog.market/v1/resource",
                    vendor_id: "vendor_crypto_993x",
                    requested_amount_sats: 500,
                    payTo: X402_PAY_TO,
                    vendor_history: {
                      fulfillment_rate: 0.98,
                      dispute_ratio: 0.01,
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Consensus threat intelligence report",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/EvaluateResponse" },
                },
              },
            },
            "400": {
              description: "Paid retry with a body missing payload object",
            },
            "402": { description: "Payment Required" },
            "500": { description: "Evaluation failed after payment" },
          },
        },
      },
    },
    components: {
      schemas: {
        EvaluateRequest: {
          type: "object",
          required: ["payload"],
          properties: {
            caller_id: {
              type: "string",
              description: "Optional agent identifier for telemetry",
            },
            payload: { $ref: "#/components/schemas/X402Payload" },
          },
        },
        X402Payload: {
          type: "object",
          required: ["endpoint_url"],
          properties: {
            endpoint_url: {
              type: "string",
              format: "uri",
              description: "Vendor x402 resource URL to preflight",
            },
            vendor_id: { type: "string" },
            requested_amount_sats: { type: "number" },
            payTo: {
              type: "string",
              description: "Advertised payTo to compare against the live 402",
            },
            pay_to: { type: "string" },
            vendor_history: {
              type: "object",
              properties: {
                fulfillment_rate: { type: "number" },
                dispute_ratio: { type: "number" },
              },
            },
          },
        },
        EvaluateResponse: {
          type: "object",
          required: [
            "status",
            "final_creditability_score",
            "final_recommendation",
            "trust_level",
            "aggregated_flags",
            "node_reports",
          ],
          properties: {
            status: { type: "string", enum: ["success"] },
            caller_id: { type: "string" },
            final_creditability_score: {
              type: "integer",
              minimum: 0,
              maximum: 1000,
            },
            final_recommendation: {
              type: "string",
              enum: ["GO", "NO-GO", "NO-GO (Caution)"],
            },
            trust_level: { type: "string" },
            aggregated_flags: { type: "array", items: { type: "string" } },
            node_reports: {
              type: "array",
              items: { $ref: "#/components/schemas/NodeReport" },
            },
            agentcash_intel: { type: "object" },
          },
        },
        NodeReport: {
          type: "object",
          required: ["node", "score", "recommendation", "flags", "trust_level"],
          properties: {
            node: { type: "string" },
            score: { type: "integer", minimum: 0, maximum: 1000 },
            recommendation: { type: "string" },
            flags: { type: "array", items: { type: "string" } },
            trust_level: { type: "string" },
          },
        },
        Catalog: {
          type: "object",
          properties: {
            name: { type: "string" },
            method: { type: "string" },
            price: { type: "string" },
            network: { type: "string", example: X402_NETWORK },
            payTo: { type: "string", example: X402_PAY_TO },
            facilitator: { type: "string" },
            facilitator_url: { type: "string" },
            catalog: { type: "object" },
            body: { type: "object" },
          },
        },
      },
    },
  };
}

export function buildLlmsTxt(origin: string): string {
  const amount = decimalUsd(EVAL_PRICE);
  return `# x402 Crediting Swarm

Pay-per-call x402 credit scoring for agentic buyers. Unpaid POST /api/swarm returns HTTP 402.

## Origin

${origin}

## Discovery

- OpenAPI: ${origin}/openapi.json
- Catalog (free): GET ${origin}/api/swarm
- Paid evaluation: POST ${origin}/api/swarm  (${amount} USD USDC, x402)

## Agent workflow

1. GET ${origin}/openapi.json
2. POST ${origin}/api/swarm with {"payload":{"endpoint_url":"https://..."}}
3. On 402, retry with x402 PAYMENT-SIGNATURE (AgentCash fetch handles this)
4. Read final_recommendation and final_creditability_score

## Example

npx agentcash@latest fetch ${origin}/api/swarm -m POST --payment-network base --payment-protocol x402 -b '{"caller_id":"agentcash","payload":{"endpoint_url":"https://api.example/v1"}}'
`;
}
