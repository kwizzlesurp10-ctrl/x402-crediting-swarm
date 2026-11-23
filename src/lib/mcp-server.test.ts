import assert from "node:assert/strict";
import test from "node:test";
import { buildMcpServerCard, handleMcpJsonRpc } from "./mcp-server.ts";

const noopEval = async () => ({ status: 200, body: { ok: true } });

test("buildMcpServerCard exposes complete schemas and annotations for 4 tools", () => {
  const card = buildMcpServerCard("https://x402-crediting-swarm.vercel.app");
  assert.equal(card.transport, "streamable-http");
  assert.equal(card.endpoint, "https://x402-crediting-swarm.vercel.app/mcp");
  assert.equal(
    card.x402.paidEndpoint,
    "https://x402-crediting-swarm.vercel.app/api/swarm",
  );
  assert.equal(card.tools.length, 4);
  for (const tool of card.tools) {
    assert.equal(typeof tool.name, "string");
    assert.equal(tool.inputSchema.type, "object");
    assert.equal(tool.inputSchema.additionalProperties, false);
    for (const [propName, propVal] of Object.entries(tool.inputSchema.properties)) {
      const p = propVal as { description?: string };
      assert.equal(
        typeof p.description,
        "string",
        `input property ${tool.name}.${propName} missing description`,
      );
    }
    assert.equal(tool.outputSchema.type, "object");
    for (const [propName, propVal] of Object.entries(tool.outputSchema.properties)) {
      const p = propVal as { type?: string; description?: string };
      assert.equal(typeof p.type, "string", `output ${tool.name}.${propName} missing type`);
      assert.equal(
        typeof p.description,
        "string",
        `output ${tool.name}.${propName} missing description`,
      );
    }
    assert.equal(typeof tool.annotations.title, "string");
    assert.equal(typeof tool.annotations.readOnlyHint, "boolean");
    assert.equal(typeof tool.annotations.destructiveHint, "boolean");
    assert.equal(typeof tool.annotations.idempotentHint, "boolean");
    assert.equal(typeof tool.annotations.openWorldHint, "boolean");
  }
});

test("handleMcpJsonRpc supports initialize, initialized, ping, and tools/list", async () => {
  const initRes = await handleMcpJsonRpc(
    { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
    { origin: "https://x402-crediting-swarm.vercel.app", evaluateSwarm: noopEval },
  );
  assert.equal(initRes.status, 200);
  const initBody = initRes.body as {
    jsonrpc: string;
    id: number;
    result: { protocolVersion: string; serverInfo: { name: string } };
  };
  assert.equal(initBody.jsonrpc, "2.0");
  assert.equal(initBody.id, 1);
  assert.equal(initBody.result.serverInfo.name, "x402-crediting-swarm");

  const notifRes = await handleMcpJsonRpc(
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { origin: "https://x402-crediting-swarm.vercel.app", evaluateSwarm: noopEval },
  );
  assert.equal(notifRes.status, 202);
  assert.equal(notifRes.body, null);

  const pingRes = await handleMcpJsonRpc(
    { jsonrpc: "2.0", id: 2, method: "ping" },
    { origin: "https://x402-crediting-swarm.vercel.app", evaluateSwarm: noopEval },
  );
  assert.equal(pingRes.status, 200);

  const listRes = await handleMcpJsonRpc(
    { jsonrpc: "2.0", id: 3, method: "tools/list", params: {} },
    { origin: "https://x402-crediting-swarm.vercel.app", evaluateSwarm: noopEval },
  );
  assert.equal(listRes.status, 200);
  const listBody = listRes.body as {
    result: { tools: Array<{ name: string; inputSchema: { type: string } }> };
  };
  assert.equal(listBody.result.tools.length, 4);
});

test("tools/call handles free tools, unknown tools, and 402 payment wrapping", async () => {
  const healthRes = await handleMcpJsonRpc(
    {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "swarm_health", arguments: {} },
    },
    { origin: "https://x402-crediting-swarm.vercel.app", evaluateSwarm: noopEval },
  );
  assert.equal(healthRes.status, 200);
  const healthBody = healthRes.body as {
    result: {
      isError?: boolean;
      structuredContent: { status: string; nodes: string[] };
      content: Array<{ type: string; text: string }>;
    };
  };
  assert.notEqual(healthBody.result.isError, true);
  assert.equal(healthBody.result.structuredContent.status, "online");
  assert.equal(healthBody.result.content[0].type, "text");

  const inboxRes = await handleMcpJsonRpc(
    {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "agentmail_inbox", arguments: { limit: 5 } },
    },
    { origin: "https://x402-crediting-swarm.vercel.app", evaluateSwarm: noopEval },
  );
  assert.equal(inboxRes.status, 200);

  const paid402Res = await handleMcpJsonRpc(
    {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "evaluate_x402_credit",
        arguments: { payload: { endpoint_url: "https://example.com" } },
      },
    },
    {
      origin: "https://x402-crediting-swarm.vercel.app",
      evaluateSwarm: async () => ({
        status: 402,
        headers: { "payment-required": "base64-requirement" },
        body: { x402Version: 2, accepts: [{ scheme: "exact" }] },
      }),
    },
  );
  assert.equal(paid402Res.status, 200);
  assert.equal(paid402Res.headers?.["PAYMENT-REQUIRED"], "base64-requirement");
  const paid402Body = paid402Res.body as {
    result: {
      isError: boolean;
      _meta: { "x402/payment-required": { x402Version: number } };
    };
  };
  assert.equal(paid402Body.result.isError, true);
  assert.equal(paid402Body.result._meta["x402/payment-required"].x402Version, 2);

  const unknownRes = await handleMcpJsonRpc(
    {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "does_not_exist", arguments: {} },
    },
    { origin: "https://x402-crediting-swarm.vercel.app", evaluateSwarm: noopEval },
  );
  assert.equal(unknownRes.status, 200);
  const unknownBody = unknownRes.body as { result: { isError: boolean } };
  assert.equal(unknownBody.result.isError, true);
});
