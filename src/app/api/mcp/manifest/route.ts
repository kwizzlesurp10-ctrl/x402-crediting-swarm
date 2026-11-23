import { NextResponse } from "next/server";
import { MCP_TOOLS } from "@/lib/mcp-server";

export async function GET() {
  const manifest = {
    schema_version: "v1",
    name: "x402-crediting-swarm",
    description:
      "3-Node consensus swarm for analyzing x402 micropayment legitimacy and sending AgentMail threat alerts.",
    version: "2.0.1",
    tools: MCP_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      annotations: tool.annotations,
    })),
  };

  return NextResponse.json(manifest, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
  });
}
