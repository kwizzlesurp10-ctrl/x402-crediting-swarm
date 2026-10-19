import { NextRequest, NextResponse } from "next/server";
import { A2A_X402_EXTENSION_URI, handleA2a } from "@/lib/a2a";
import { publicOrigin } from "@/lib/public-origin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "X-A2A-Extensions",
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } },
      { status: 400, headers: CORS },
    );
  }
  const result = await handleA2a(body, { origin: publicOrigin(req) });
  const requested = req.headers.get("x-a2a-extensions") || req.headers.get("a2a-extensions") || "";
  return NextResponse.json(result, {
    headers: {
      ...CORS,
      ...(requested.includes(A2A_X402_EXTENSION_URI) ? { "X-A2A-Extensions": A2A_X402_EXTENSION_URI } : {}),
    },
  });
}

export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  return NextResponse.json(
    {
      protocol: "A2A JSON-RPC 0.3",
      methods: ["message/send", "tasks/get"],
      agentCard: `${origin}/.well-known/agent-card.json`,
      hint: 'POST {"jsonrpc":"2.0","id":1,"method":"message/send","params":{"message":{"role":"user","parts":[{"kind":"data","data":{"payload":{"endpoint_url":"https://api.example/v1/resource"}}}],"metadata":{"skillId":"evaluate-x402-payload"}}}}',
    },
    { headers: CORS },
  );
}
