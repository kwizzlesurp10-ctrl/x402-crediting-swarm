/**
 * Minimal A2A 0.3 JSON-RPC endpoint (message/send, tasks/get) with the
 * a2a-x402 v0.2 standalone payment flow, layered on the existing paid
 * POST /api/swarm route so pricing, verification and CDP settlement have a
 * single implementation.
 *
 * - Unpaid message/send → task `input-required` with
 *   metadata["x402.payment.status"] = "payment-required" and
 *   metadata["x402.payment.required"] = the decoded PAYMENT-REQUIRED body.
 * - message/send carrying metadata["x402.payment.payload"] (a signed x402 v2
 *   PaymentPayload) plus the input → forwarded to /api/swarm as
 *   PAYMENT-SIGNATURE; a 200 becomes a `completed` task with the report as an
 *   artifact and the settlement receipt under x402.payment.receipts.
 *
 * Stateless by design (Vercel functions share no memory), so the paid message
 * must repeat the input; tasks/get only knows tasks from the same instance.
 */
import { randomUUID } from "node:crypto";

export const A2A_X402_EXTENSION_URI =
  "https://github.com/google-agentic-commerce/a2a-x402/blob/main/spec/v0.2";
export const SWARM_SKILL_ID = "evaluate-x402-payload";

type Part = { kind: "text" | "data"; text?: string; data?: Record<string, unknown> };
type Message = {
  kind?: "message";
  messageId?: string;
  role?: string;
  parts?: Part[];
  taskId?: string;
  contextId?: string;
  metadata?: Record<string, unknown>;
};
type JsonRpcBody = { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };

export type A2aTask = {
  kind: "task";
  id: string;
  contextId: string;
  status: { state: string; timestamp: string; message?: Record<string, unknown> };
  artifacts?: Array<{ artifactId: string; name: string; parts: Part[] }>;
  metadata?: Record<string, unknown>;
};

const tasks = new Map<string, A2aTask>();
const MAX_TASKS = 500;

function remember(task: A2aTask): A2aTask {
  if (tasks.size >= MAX_TASKS) {
    const first = tasks.keys().next().value;
    if (first) tasks.delete(first);
  }
  tasks.set(task.id, task);
  return task;
}

function agentMessage(taskId: string, contextId: string, text: string, metadata?: Record<string, unknown>, data?: Record<string, unknown>) {
  const parts: Part[] = [{ kind: "text", text }];
  if (data) parts.push({ kind: "data", data });
  return { kind: "message", messageId: randomUUID(), role: "agent", taskId, contextId, parts, ...(metadata ? { metadata } : {}) };
}

function task(id: string, contextId: string, state: string, text: string, metadata?: Record<string, unknown>, data?: Record<string, unknown>): A2aTask {
  return {
    kind: "task",
    id,
    contextId,
    status: { state, timestamp: new Date().toISOString(), message: agentMessage(id, contextId, text, metadata, data) },
    metadata: { skillId: SWARM_SKILL_ID },
  };
}

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

/** Pull {payload, caller_id} from metadata.input or data parts. */
export function extractInput(message: Message): { skillId: string; input: Record<string, unknown> } {
  const meta = message.metadata ?? {};
  let skillId = typeof meta.skillId === "string" ? meta.skillId : "";
  let input: Record<string, unknown> = {};
  if (meta.input && typeof meta.input === "object" && !Array.isArray(meta.input)) {
    input = { ...(meta.input as Record<string, unknown>) };
  }
  for (const part of message.parts ?? []) {
    if (part.kind === "data" && part.data && typeof part.data === "object") {
      const { skillId: sid, input: nested, ...rest } = part.data as Record<string, unknown>;
      if (!skillId && typeof sid === "string") skillId = sid;
      if (nested && typeof nested === "object" && !Array.isArray(nested)) Object.assign(input, nested);
      Object.assign(input, rest);
    }
  }
  return { skillId: skillId || SWARM_SKILL_ID, input };
}

function encodePaymentSignature(payload: unknown): string | null {
  if (!payload) return null;
  if (typeof payload === "string") return payload; // already base64
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function decodeHeader(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export async function handleA2a(
  body: JsonRpcBody,
  opts: { origin: string; fetchImpl?: typeof fetch },
): Promise<Record<string, unknown>> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const id = body?.id;
  const method = (body?.method ?? "").trim();
  if (body?.jsonrpc !== "2.0" || !method) return rpcError(id, -32600, "invalid JSON-RPC 2.0 request");

  if (method === "tasks/get" || method === "GetTask") {
    const tid = String((body.params ?? {}).id ?? "");
    const found = tasks.get(tid);
    return found ? rpcResult(id, found) : rpcError(id, -32001, `task not found: ${tid}`);
  }
  if (method === "tasks/cancel" || method === "CancelTask") {
    return rpcError(id, -32002, "task not cancelable");
  }
  if (method !== "message/send" && method !== "SendMessage") {
    return rpcError(id, -32601, `method not found: ${method}`);
  }

  const message = (body.params ?? {}).message as Message | undefined;
  if (!message || !Array.isArray(message.parts)) return rpcError(id, -32602, "params.message with parts is required");

  const taskId = message.taskId || randomUUID();
  const contextId = message.contextId || randomUUID();
  const { skillId, input } = extractInput(message);
  if (skillId !== SWARM_SKILL_ID) {
    return rpcResult(id, remember(task(taskId, contextId, "failed", `unknown skillId: ${skillId}`)));
  }

  const meta = message.metadata ?? {};
  const signature = encodePaymentSignature(meta["x402.payment.payload"]);
  const swarmBody = { payload: input.payload, ...(typeof input.caller_id === "string" ? { caller_id: input.caller_id } : {}) };
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signature) headers["PAYMENT-SIGNATURE"] = signature;

  let res: Response;
  try {
    res = await fetchImpl(`${opts.origin}/api/swarm`, { method: "POST", headers, body: JSON.stringify(swarmBody) });
  } catch (err) {
    return rpcResult(id, remember(task(taskId, contextId, "failed", `upstream error: ${err instanceof Error ? err.message : "fetch failed"}`)));
  }

  if (res.status === 402) {
    const required = decodeHeader(res.headers.get("payment-required"));
    const status = signature ? "payment-failed" : "payment-required";
    return rpcResult(
      id,
      remember(
        task(
          taskId,
          contextId,
          "input-required",
          signature
            ? "Payment verification or settlement failed; sign a fresh payment for the requirements below."
            : "Payment is required to run evaluate-x402-payload. Sign one of accepts[] and resend with metadata x402.payment.payload plus the same input.",
          { "x402.payment.status": status, "x402.payment.required": required },
          { skillId: SWARM_SKILL_ID, input },
        ),
      ),
    );
  }

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    return rpcResult(id, remember(task(taskId, contextId, "failed", `swarm returned ${res.status}: ${JSON.stringify(json)}`)));
  }
  const receipt = decodeHeader(res.headers.get("payment-response"));
  const done: A2aTask = {
    ...task(taskId, contextId, "completed", "Evaluation complete.", {
      "x402.payment.status": "payment-completed",
      ...(receipt ? { "x402.payment.receipts": [receipt] } : {}),
    }),
    artifacts: [{ artifactId: randomUUID(), name: "swarm-report.json", parts: [{ kind: "data", data: json ?? {} }] }],
  };
  return rpcResult(id, remember(done));
}
