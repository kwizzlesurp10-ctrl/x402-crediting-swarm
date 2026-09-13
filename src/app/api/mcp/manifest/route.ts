import { NextResponse } from 'next/server';

export async function GET() {
  const manifest = {
    schema_version: "v1",
    name: "x402-crediting-swarm",
    description: "3-Node consensus swarm for analyzing x402 micropayment legitimacy and sending AgentMail threat alerts.",
    version: "2.0.0",
    tools: [
      {
        name: "evaluate_x402_credit",
        description: "Evaluates an x402 (Payment Required) call payload across 3 consensus nodes (Alpha, Beta, Gamma) and returns a credit score (0-1000) with GO/NO-GO recommendation.",
        parameters: {
          type: "object",
          properties: {
            caller_id: { type: "string", description: "Identifier of the calling AI agent" },
            payload: {
              type: "object",
              description: "The x402 call details, vendor history, and requested payment amount"
            }
          },
          required: ["payload"]
        }
      },
      {
        name: "agentmail_send",
        description: "Dispatches an inter-agent message or threat alert over the AgentMail rail.",
        parameters: {
          type: "object",
          properties: {
            to: { type: "string", description: "Recipient agent ID or address" },
            subject: { type: "string", description: "Subject line" },
            body: { type: "string", description: "Message body" },
            priority: { type: "string", enum: ["low", "normal", "high", "urgent"] }
          },
          required: ["to", "subject", "body"]
        }
      },
      {
        name: "agentmail_inbox",
        description: "Reads recent AgentMail inbox messages or threat alerts.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Maximum messages to return" }
          }
        }
      },
      {
        name: "swarm_health",
        description: "Checks 3-node swarm status, x402 v2 payment requirements, and configuration.",
        parameters: { type: "object", properties: {} }
      }
    ]
  };

  return NextResponse.json(manifest, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    }
  });
}
