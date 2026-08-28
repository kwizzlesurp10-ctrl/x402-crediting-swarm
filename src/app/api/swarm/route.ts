import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

export const maxDuration = 60; // Set max duration for Vercel

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
  trust_level: z.string()
});

async function runNode(nodeName: string, payload: any) {
  try {
    const { object } = await generateObject({
      model: google('gemini-1.5-flash'),
      system: `${swarmSystemPrompt}\n\nYou are acting as: ${nodeName}`,
      prompt: `Please evaluate this x402 payload:\n\n${JSON.stringify(payload, null, 2)}`,
      schema: ReportSchema,
    });
    return { node: nodeName, ...object };
  } catch (error) {
    console.error(`Error in ${nodeName}:`, error);
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    const { caller_id, payload, fee_paid } = await req.json();

    if (!fee_paid) {
      return new Response(JSON.stringify({
        status: "error",
        message: "Fee Collection Gate Failed: Valid micropayment required."
      }), { status: 402, headers: { 'Content-Type': 'application/json' } });
    }

    // Concurrent invocation of the 3 nodes
    const nodes = ["x402_node_alpha", "x402_node_beta", "x402_node_gamma"];
    const results = await Promise.all(nodes.map(node => runNode(node, payload)));

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

    const allFlags = Array.from(new Set(results.flatMap(r => r.flags)));

    const report = {
      status: "success",
      final_creditability_score: averageScore,
      final_recommendation: finalRecommendation,
      trust_level: trustLevel,
      aggregated_flags: allFlags,
      node_reports: results
    };

    return new Response(JSON.stringify(report), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
