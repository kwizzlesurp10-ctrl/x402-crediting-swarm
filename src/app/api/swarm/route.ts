import { generateText, gateway, Output } from "ai";
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
import { sendAgentMail } from "@/lib/agentmail";

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

const SWARM_MODEL =
  process.env.SWARM_MODEL ?? "google/gemini-3.8-flash";

function runHeuristicNode(nodeName: string, payload: any): NodeReport {
  const fulfillment = payload?.vendor_history?.fulfillment_rate ?? 0.95;
  const disputeRatio = payload?.vendor_history?.dispute_ratio ?? 0.01;
  const amountSats = payload?.requested_amount_sats ?? 500;
  const endpointUrl = payload?.endpoint_url || "";

  let baseScore = Math.round(fulfillment * 900 - disputeRatio * 1500);
  const flags: string[] = [];

  if (disputeRatio > 0.05) {
    flags.push(`High vendor dispute ratio: ${(disputeRatio * 100).toFixed(1)}%`);
    baseScore -= 150;
  }
  if (fulfillment < 0.90) {
    flags.push(`Sub-par fulfillment rate: ${(fulfillment * 100).toFixed(1)}%`);
    baseScore -= 100;
  }
  if (amountSats > 10000) {
    flags.push(`Abnormally high micropayment request: ${amountSats} Sats`);
    baseScore -= 200;
  }
  if (endpointUrl && !endpointUrl.startsWith("https://")) {
    flags.push("Insecure HTTP endpoint URL detected");
    baseScore -= 300;
  }

  if (nodeName === "x402_node_alpha") {
    baseScore += 20;
  } else if (nodeName === "x402_node_beta") {
    baseScore -= 10;
  } else if (nodeName === "x402_node_gamma") {
    baseScore += 5;
  }

  const finalScore = Math.max(0, Math.min(1000, baseScore));
  let rec = "GO";
  let trust = "High Trust (Safe to auto-pay)";
  if (finalScore < 500) {
    rec = "NO-GO";
    trust = "Low Trust / Fraud Risk (DO NOT PAY)";
  } else if (finalScore < 800) {
    rec = "NO-GO (Caution)";
    trust = "Moderate Trust (User confirmation recommended)";
  }

  return {
    node: nodeName,
    score: finalScore,
    recommendation: rec,
    flags,
    trust_level: trust,
  };
}

async function runNode(
  nodeName: string,
  payload: unknown,
  intel: AgentcashIntel,
): Promise<NodeReport> {
  try {
    const { output } = await generateText({
      model: gateway(SWARM_MODEL),
      system: `${swarmSystemPrompt}\n\nYou are acting as: ${nodeName}

Live intel was purchased (or attempted) via AgentCash x402 APIs. Treat that intel as ground truth for Bazaar listing, live 402 payTo, and seller volume. Never fabricate catalog registration or payTo_match results that the intel does not contain.`,
      prompt: `Evaluate this x402 payload:

${JSON.stringify(payload, null, 2)}

AgentCash live intel:
${formatIntelForPrompt(intel)}`,
      output: Output.object({ schema: ReportSchema }),
      providerOptions: {
        gateway: {
          models: [
            "google/gemini-3.5-flash-lite",
            "google/gemini-2.5-flash",
          ],
          tags: ["x402-crediting-swarm", nodeName],
        },
      },
    });
    if (output) {
      return { node: nodeName, ...output };
    }
  } catch (err) {
    console.warn(`[Swarm] Model execution for ${nodeName} unavailable, utilizing heuristic assessment:`, err);
  }
  return runHeuristicNode(nodeName, payload);
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
    endpoints: {
      swarm_eval: "POST /api/swarm",
      agentmail_send: "POST /api/mailrail",
      agentmail_inbox: "GET /api/mailrail",
      openapi_spec: "GET /api/openapi.json",
      mcp_manifest: "GET /.well-known/mcp.json"
    }
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

    // Auto-dispatch AgentMail Threat Alert on score < 500
    if (averageScore < 500) {
      const endpoint = (payload as any)?.endpoint_url || "unknown endpoint";
      sendAgentMail({
        from: "swarm_postmaster@x402-crediting-swarm.onrender.com",
        to: callerId || "all-agents@x402-mcp",
        subject: `🚨 CRITICAL THREAT ALERT: High Fraud Risk (Score ${averageScore}/1000)`,
        body: `x402 Crediting Swarm evaluation for vendor endpoint '${endpoint}' returned NO-GO due to risk flags: ${allFlags.join('; ') || 'High risk profile'}.`,
        priority: "urgent",
        metadata: {
          score: averageScore,
          recommendation: finalRecommendation,
          flags: allFlags,
          payload
        }
      });
    }

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
  try {
    const clone = req.clone();
    const body = await clone.json().catch(() => ({}));
    const xPaymentHeader = req.headers.get("x-payment") || req.headers.get("payment-signature");

    // Allow simulated fee gate (fee_paid: true) or simulated header bypass
    if (
      body?.fee_paid === true ||
      body?.feePaid === true ||
      (xPaymentHeader && xPaymentHeader.includes("simulated"))
    ) {
      return evaluate(rewriteRequestToPublicOrigin(req));
    }
  } catch (e) {
    // Fall back to paidPost
  }

  return paidPost(rewriteRequestToPublicOrigin(req));
}
