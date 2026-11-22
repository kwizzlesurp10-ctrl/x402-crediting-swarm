import { getAgentMailInbox, sendAgentMail } from "./agentmail.ts";
import {
  EVAL_PRICE,
  X402_NETWORK,
  X402_PAY_TO,
} from "./swarm-route-config.ts";

export const MCP_PROTOCOL_VERSION = "2025-03-26";

export type McpToolDef = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export const MCP_TOOLS: McpToolDef[] = [
  {
    name: "evaluate_x402_credit",
    description:
      "Evaluates an x402 (Payment Required) call payload across 3 consensus nodes (Alpha, Beta, Gamma) and returns a credit score (0-1000) with GO/NO-GO recommendation.",
    inputSchema: {
      type: "object",
      properties: {
        caller_id: {
          type: "string",
          description: "Identifier of the calling AI agent",
        },
        payload: {
          type: "object",
          description:
            "The x402 call details, vendor history, and requested payment amount",
        },
      },
      required: ["payload"],
    },
  },
  {
    name: "agentmail_send",
    description:
      "Dispatches an inter-agent message or threat alert over the AgentMail rail.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient agent ID or address" },
        subject: { type: "string", description: "Subject line" },
        body: { type: "string", description: "Message body" },
        priority: {
          type: "string",
          enum: ["low", "normal", "high", "urgent"],
        },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "agentmail_inbox",
    description: "Reads recent AgentMail inbox messages or threat alerts.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum messages to return" },
      },
    },
  },
  {
    name: "swarm_health",
    description:
      "Checks 3-node swarm status, x402 v2 payment requirements, and configuration.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

function facilitatorKind(): "cdp" | "payai" | "x402.org" {
  const hasCdp = Boolean(
    process.env.CDP_API_KEY_ID?.trim() && process.env.CDP_API_KEY_SECRET?.trim(),
  );
  if (hasCdp) return "cdp";
  return X402_NETWORK === "eip155:8453" ? "payai" : "x402.org";
}

export function buildMcpServerCard(origin: string) {
  const cleanOrigin = origin.replace(/\/+$/, "");
  return {
    schema_version: "v1",
    name: "x402-crediting-swarm",
    title: "x402 Crediting Swarm",
    version: "2.0.0",
    description:
      "3-Node consensus swarm for analyzing x402 micropayment legitimacy and sending AgentMail threat alerts.",
    protocolVersion: MCP_PROTOCOL_VERSION,
    transport: "streamable-http",
    endpoint: `${cleanOrigin}/mcp`,
    manifest: `${cleanOrigin}/.well-known/mcp.json`,
    wellKnownX402: `${cleanOrigin}/.well-known/x402`,
    methods_supported: [
      "initialize",
      "notifications/initialized",
      "ping",
      "tools/list",
      "tools/call",
    ],
    x402: {
      version: 2,
      price: EVAL_PRICE,
      network: X402_NETWORK,
      payTo: X402_PAY_TO,
      facilitator: facilitatorKind(),
      paidEndpoint: `${cleanOrigin}/api/swarm`,
    },
    tools: MCP_TOOLS,
  };
}

export type SwarmEvalResponse = {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
};

export type McpRpcResponse = {
  status: number;
  body: unknown | null;
  headers?: Record<string, string>;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function mcpTextResult(
  id: unknown,
  data: unknown,
  opts?: {
    isError?: boolean;
    structuredContent?: unknown;
    _meta?: Record<string, unknown>;
  },
) {
  return {
    jsonrpc: "2.0" as const,
    id: id ?? null,
    result: {
      content: [{ type: "text" as const, text: JSON.stringify(data) }],
      ...(opts?.isError ? { isError: true } : {}),
      ...(opts?.structuredContent !== undefined
        ? { structuredContent: opts.structuredContent }
        : {}),
      ...(opts?._meta ? { _meta: opts._meta } : {}),
    },
  };
}

function extractHeaderCaseInsensitive(
  headers: Record<string, string> | undefined,
  targetName: string,
): string | undefined {
  if (!headers) return undefined;
  const lower = targetName.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower && v) return v;
  }
  return undefined;
}

export async function handleMcpJsonRpc(
  body: unknown,
  ctx: {
    origin: string;
    evaluateSwarm: (
      args: Record<string, unknown>,
      metaPayment?: unknown,
    ) => Promise<SwarmEvalResponse>;
  },
): Promise<McpRpcResponse> {
  if (!isPlainObject(body) || typeof body.method !== "string" || !body.method.trim()) {
    return {
      status: 400,
      body: {
        jsonrpc: "2.0",
        id: isPlainObject(body) ? (body.id ?? null) : null,
        error: { code: -32600, message: "Invalid Request" },
      },
    };
  }

  const id = body.id ?? null;
  const method = body.method.trim();
  const params = isPlainObject(body.params) ? body.params : {};

  if (method === "initialize") {
    return {
      status: 200,
      body: {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "x402-crediting-swarm", version: "2.0.0" },
        },
      },
    };
  }

  if (method === "notifications/initialized") {
    return { status: 202, body: null };
  }

  if (method === "ping") {
    return {
      status: 200,
      body: { jsonrpc: "2.0", id, result: {} },
    };
  }

  if (method === "tools/list") {
    return {
      status: 200,
      body: {
        jsonrpc: "2.0",
        id,
        result: { tools: MCP_TOOLS },
      },
    };
  }

  if (method === "tools/call") {
    const toolName = typeof params.name === "string" ? params.name : "";
    const args = isPlainObject(params.arguments) ? params.arguments : {};
    const meta = isPlainObject(params._meta) ? params._meta : undefined;

    if (toolName === "swarm_health") {
      const data = {
        status: "online",
        version: "2.0.0",
        nodes: ["x402_node_alpha", "x402_node_beta", "x402_node_gamma"],
        x402_config: {
          price: EVAL_PRICE,
          network: X402_NETWORK,
          payTo: X402_PAY_TO,
          facilitator: facilitatorKind(),
          paidEndpoint: `${ctx.origin.replace(/\/+$/, "")}/api/swarm`,
        },
      };
      return {
        status: 200,
        body: mcpTextResult(id, data, { structuredContent: data }),
      };
    }

    if (toolName === "agentmail_inbox") {
      const limit =
        typeof args.limit === "number" && Number.isFinite(args.limit) && args.limit > 0
          ? Math.floor(args.limit)
          : 20;
      const inbox = getAgentMailInbox(limit);
      const data = { inbox, count: inbox.length };
      return {
        status: 200,
        body: mcpTextResult(id, data, { structuredContent: data }),
      };
    }

    if (toolName === "agentmail_send") {
      const to = typeof args.to === "string" ? args.to.trim() : "";
      const subject = typeof args.subject === "string" ? args.subject.trim() : "";
      const mailBody = typeof args.body === "string" ? args.body.trim() : "";
      if (!to || !subject || !mailBody) {
        return {
          status: 200,
          body: mcpTextResult(
            id,
            { error: "Fields 'to', 'subject', and 'body' are required non-empty strings." },
            { isError: true },
          ),
        };
      }
      const allowedPriority = new Set(["low", "normal", "high", "urgent"]);
      const priority =
        typeof args.priority === "string" && allowedPriority.has(args.priority)
          ? (args.priority as "low" | "normal" | "high" | "urgent")
          : "normal";
      const msg = sendAgentMail({ to, subject, body: mailBody, priority });
      return {
        status: 200,
        body: mcpTextResult(id, msg, { structuredContent: msg }),
      };
    }

    if (toolName === "evaluate_x402_credit") {
      const evalRes = await ctx.evaluateSwarm(args, meta?.["x402/payment"]);
      const paymentRequired = extractHeaderCaseInsensitive(
        evalRes.headers,
        "payment-required",
      );
      const paymentResponse = extractHeaderCaseInsensitive(
        evalRes.headers,
        "payment-response",
      );

      if (evalRes.status === 402) {
        return {
          status: 200,
          headers: paymentRequired ? { "PAYMENT-REQUIRED": paymentRequired } : undefined,
          body: mcpTextResult(id, evalRes.body, {
            isError: true,
            structuredContent: evalRes.body,
            _meta: { "x402/payment-required": evalRes.body },
          }),
        };
      }

      if (evalRes.status >= 400) {
        return {
          status: 200,
          body: mcpTextResult(id, evalRes.body, {
            isError: true,
            structuredContent: evalRes.body,
          }),
        };
      }

      return {
        status: 200,
        headers: paymentResponse ? { "PAYMENT-RESPONSE": paymentResponse } : undefined,
        body: mcpTextResult(id, evalRes.body, { structuredContent: evalRes.body }),
      };
    }

    return {
      status: 200,
      body: mcpTextResult(id, { error: `Unknown tool: ${toolName}` }, { isError: true }),
    };
  }

  return {
    status: 200,
    body: {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    },
  };
}
