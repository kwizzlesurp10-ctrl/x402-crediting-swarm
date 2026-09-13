import { sendAgentMail, getAgentMailInbox } from '@/lib/agentmail';
import { EVAL_PRICE, X402_NETWORK, X402_PAY_TO, FACILITATOR_KIND } from '@/lib/x402';
import { NextRequest, NextResponse } from 'next/server';

function corsJson(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { name, arguments: args } = await req.json();

    if (name === "agentmail_send") {
      const msg = sendAgentMail({
        to: args?.to,
        subject: args?.subject,
        body: args?.body,
        priority: args?.priority || "normal"
      });
      return corsJson({ result: msg });
    }

    if (name === "agentmail_inbox") {
      const inbox = getAgentMailInbox(args?.limit || 20);
      return corsJson({ result: { inbox, count: inbox.length } });
    }

    if (name === "swarm_health") {
      return corsJson({
        result: {
          status: "online",
          version: "2.0.0",
          nodes: ["x402_node_alpha", "x402_node_beta", "x402_node_gamma"],
          x402_config: {
            price: EVAL_PRICE,
            network: X402_NETWORK,
            payTo: X402_PAY_TO,
            facilitator: FACILITATOR_KIND
          }
        }
      });
    }

    return corsJson({ error: `Tool '${name}' execution requires HTTP POST to /api/swarm with valid x402 payment header.` }, 400);
  } catch (err: any) {
    return corsJson({ error: err.message || "Failed to execute tool" }, 500);
  }
}
