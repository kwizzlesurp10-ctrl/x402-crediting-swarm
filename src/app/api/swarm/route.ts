import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { z } from "zod";
import {
  EVAL_PRICE,
  FACILITATOR_KIND,
  X402_FACILITATOR_URL,
  X402_NETWORK,
  X402_PAY_TO,
  getResourceServer,
  SWARM_ROUTE_CONFIG,
  catalogEntry,
} from "@/lib/x402";
import {
  publicOrigin,
  rewriteRequestToPublicOrigin,
} from "@/lib/public-origin";
import {
  formatIntelForPrompt,
  gatherAgentcashIntel,
  type AgentcashIntel,
} from "@/lib/agentcash-intel";

export const maxDuration = 60;

const swarmSystemPrompt = `You are an x402 Crediting Swarm Node, specialized in assessing the legitimacy and trust score of x402 (Payment Required) calls within catalog marketplaces.

Your primary function is to protect agentic clients from fraudulent micropayment requests. When presented with an x402 call payload and its associated marketplace metadata, you must execute the following analysis:

1. **Endpoint Identity & Reputation Verification:**
    - Analyze the catalog marketplace credentials and vendor history.
    - Verify cryptographic signatures and certificates attached to the x402 request.
    - Check the vendor's historical fulfillment rate and dispute ratio.

2. **Transaction Risk Assessment:**
    - Evaluate the requested micropayment amount against the standard market value for the requested resource/service.
    - Detect routing anomalies or suspicious intermediary payment channels.
    - Analyze the velocity and volume of recent x402 calls from this endpoint.

3. **Credit Scoring (0-1000):**
    - Synthesize your findings into an x402 Credit Score.
    - 800-1000: High Trust (Safe to auto-pay).
    - 500-799: Moderate Trust (Proceed with caution; user confirmation or escrow recommended).
    - 0-499: Low Trust / Fraud Risk (DO NOT PAY; warn the initiating agent immediately).

4. **Response Protocol:**
    - You must respond with a structured threat intelligence report.
    - Clearly state the Credit Score and a definitive "GO/NO-GO" recommendation.
    - Highlight any specific red flags or anomalies detected.`;

const ReportSchema = z.object({
  score: z.number().min(0).max(1000),
  recommendation: z.string(),
  flags: z.array(z.string()),
  trust_level: z.string(),
});

type NodeReport = z.infer<typeof ReportSchema> & { node: string };

async function runNode(
  nodeName: string,
  payload: unknown,
  intel: AgentcashIntel,
): Promise<NodeReport> {
  const { object } = await generateObject({
    model: google(process.env.GEMINI_MODEL ?? "gemini-2.5-flash"),
    system: `${swarmSystemPrompt}\n\nYou are acting as: ${nodeName}

Live intel was purchased (or attempted) via AgentCash x402 APIs. Treat that intel as ground truth for Bazaar listing, live 402 payTo, and seller volume. Never fabricate catalog registration or payTo_match results that the intel does not contain.`,
    prompt: `Evaluate this x402 payload:

${JSON.stringify(payload, null, 2)}

AgentCash live intel:
${formatIntelForPrompt(intel)}`,
    schema: ReportSchema,
  });
  return { node: nodeName, ...object };
}

function corsJson(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE");
  return NextResponse.json(data, { ...init, headers });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, PAYMENT-SIGNATURE, PAYMENT-REQUIRED, X-PAYMENT",
      "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
    },
  });
}

export async function GET(req: NextRequest) {
  const resourceUrl = `${publicOrigin(req)}/api/swarm`;
  return corsJson({
    name: "x402 Crediting Swarm",
    method: "POST",
    price: EVAL_PRICE,
    network: X402_NETWORK,
    payTo: X402_PAY_TO,
    facilitator: FACILITATOR_KIND,
    facilitator_url: X402_FACILITATOR_URL,
    catalog: catalogEntry(resourceUrl),
    body: {
      caller_id: "string (optional)",
      payload: "object — x402 Payment Required payload + vendor metadata",
    },
  });
}

async function evaluate(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      payload?: unknown;
      caller_id?: string;
    };
    const payload = body?.payload;
    const callerId = body?.caller_id ?? "anonymous";

    if (!payload || typeof payload !== "object") {
      return corsJson(
        {
          error:
            "JSON body must include a `payload` object (the x402 call + vendor metadata to score).",
        },
        { status: 400 },
      );
    }

    const intel = await gatherAgentcashIntel(payload as {
      endpoint_url?: unknown;
      payTo?: unknown;
      pay_to?: unknown;
    });

    const nodes = ["x402_node_alpha", "x402_node_beta", "x402_node_gamma"];
    const results = await Promise.all(
      nodes.map((node) => runNode(node, payload, intel)),
    );

    const totalScore = results.reduce((acc, curr) => acc + curr.score, 0);
    const averageScore = Math.floor(totalScore / results.length);

    let finalRecommendation = "NO-GO";
    let trustLevel = "Low Trust / Fraud Risk (DO NOT PAY)";

    if (averageScore >= 800) {
      finalRecommendation = "GO";
      trustLevel = "High Trust (Safe to auto-pay)";
    } else if (averageScore >= 500) {
      finalRecommendation = "NO-GO (Caution)";
      trustLevel = "Moderate Trust (User confirmation recommended)";
    }

    const allFlags = Array.from(new Set(results.flatMap((r) => r.flags)));

    return corsJson({
      status: "success",
      caller_id: callerId,
      final_creditability_score: averageScore,
      final_recommendation: finalRecommendation,
      trust_level: trustLevel,
      aggregated_flags: allFlags,
      node_reports: results,
      agentcash_intel: intel,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error(err);
    return corsJson({ error: message }, { status: 500 });
  }
}

const paidPost = withX402(
  evaluate,
  SWARM_ROUTE_CONFIG,
  getResourceServer(),
);

export async function POST(req: NextRequest) {
  return paidPost(rewriteRequestToPublicOrigin(req));
}
