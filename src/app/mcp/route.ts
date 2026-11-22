import { NextRequest, NextResponse } from "next/server";
import { POST as swarmPost } from "@/app/api/swarm/route";
import { buildMcpServerCard, handleMcpJsonRpc } from "@/lib/mcp-server";
import { publicOrigin } from "@/lib/public-origin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MCP_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Authorization, Mcp-Session-Id, PAYMENT-SIGNATURE, X-PAYMENT, x402-version",
  "Access-Control-Expose-Headers":
    "PAYMENT-REQUIRED, PAYMENT-RESPONSE, WWW-Authenticate, Mcp-Session-Id",
};

function encodeMetaPayment(metaPayment: unknown): string | null {
  if (!metaPayment) return null;
  if (typeof metaPayment === "string" && metaPayment.trim()) {
    return metaPayment.trim();
  }
  if (typeof metaPayment === "object") {
    return Buffer.from(JSON.stringify(metaPayment), "utf8").toString("base64");
  }
  return null;
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: MCP_CORS_HEADERS,
  });
}

export async function GET(req: NextRequest) {
  const accept = (req.headers.get("accept") ?? "").toLowerCase();
  if (accept.includes("text/event-stream")) {
    return NextResponse.json(
      {
        error: "METHOD_NOT_ALLOWED",
        message:
          "Use HTTP POST with JSON-RPC 2.0 on this stateless Streamable HTTP MCP endpoint.",
      },
      {
        status: 405,
        headers: {
          ...MCP_CORS_HEADERS,
          Allow: "POST, OPTIONS",
          Vary: "Accept",
        },
      },
    );
  }

  return NextResponse.json(buildMcpServerCard(publicOrigin(req)), {
    status: 200,
    headers: {
      ...MCP_CORS_HEADERS,
      "Cache-Control": "public, max-age=300",
      Vary: "Accept",
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const origin = publicOrigin(req);

  const result = await handleMcpJsonRpc(body, {
    origin,
    evaluateSwarm: async (args, metaPayment) => {
      const headers = new Headers({ "content-type": "application/json" });
      for (const h of [
        "host",
        "x-forwarded-host",
        "x-forwarded-proto",
        "payment-signature",
        "x-payment",
      ]) {
        const val = req.headers.get(h);
        if (val) headers.set(h, val);
      }

      if (!headers.get("payment-signature")) {
        const encoded = encodeMetaPayment(metaPayment);
        if (encoded) headers.set("payment-signature", encoded);
      }

      const payloadBody = {
        ...(typeof args.caller_id === "string" ? { caller_id: args.caller_id } : {}),
        payload:
          args.payload && typeof args.payload === "object" ? args.payload : args,
      };

      const swarmReq = new NextRequest(`${origin}/api/swarm`, {
        method: "POST",
        headers,
        body: JSON.stringify(payloadBody),
      });

      const res = await swarmPost(swarmReq);
      const resBody = await res.json().catch(() => ({}));
      const resHeaders: Record<string, string> = {};
      for (const h of ["payment-required", "payment-response"]) {
        const val = res.headers.get(h);
        if (val) resHeaders[h] = val;
      }

      return {
        status: res.status,
        body: resBody,
        headers: resHeaders,
      };
    },
  });

  const headers = {
    ...MCP_CORS_HEADERS,
    ...(result.headers ?? {}),
  };

  if (result.body === null) {
    return new NextResponse(null, { status: result.status, headers });
  }

  return NextResponse.json(result.body, {
    status: result.status,
    headers,
  });
}
