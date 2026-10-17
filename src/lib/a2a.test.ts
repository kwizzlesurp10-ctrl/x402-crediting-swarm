/* eslint-disable @typescript-eslint/no-explicit-any -- test assertions on loosely typed JSON-RPC results */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handleA2a, SWARM_SKILL_ID } from "./a2a.ts";

const ORIGIN = "https://swarm.test";
const REQUIRED = { x402Version: 2, accepts: [{ scheme: "exact", amount: "50000" }] };
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64");

function send(metadata: Record<string, unknown>, data: Record<string, unknown> = { payload: { endpoint_url: "https://api.example/x" } }) {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "message/send",
    params: { message: { role: "user", parts: [{ kind: "data", data }], metadata } },
  };
}

describe("handleA2a", () => {
  it("unpaid message/send → input-required with x402.payment.required", async () => {
    const seen: Array<Record<string, string>> = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      seen.push(init.headers as Record<string, string>);
      return new Response("{}", { status: 402, headers: { "PAYMENT-REQUIRED": b64(REQUIRED) } });
    }) as unknown as typeof fetch;
    const out = (await handleA2a(send({ skillId: SWARM_SKILL_ID }), { origin: ORIGIN, fetchImpl })) as any;
    assert.equal(out.result.status.state, "input-required");
    const meta = out.result.status.message.metadata;
    assert.equal(meta["x402.payment.status"], "payment-required");
    assert.deepEqual(meta["x402.payment.required"], REQUIRED);
    assert.equal(seen[0]["PAYMENT-SIGNATURE"], undefined);
  });

  it("paid message/send forwards PAYMENT-SIGNATURE and completes", async () => {
    let sig = "";
    let body = "";
    const fetchImpl = (async (url: string, init: RequestInit) => {
      assert.equal(url, `${ORIGIN}/api/swarm`);
      sig = (init.headers as Record<string, string>)["PAYMENT-SIGNATURE"];
      body = String(init.body);
      return new Response(JSON.stringify({ status: "success", final_creditability_score: 820 }), {
        status: 200,
        headers: { "PAYMENT-RESPONSE": b64({ success: true, transaction: "0xabc" }) },
      });
    }) as unknown as typeof fetch;
    const payload = { x402Version: 2, payload: { signature: "0x1" } };
    const out = (await handleA2a(send({ skillId: SWARM_SKILL_ID, "x402.payment.status": "payment-submitted", "x402.payment.payload": payload }), {
      origin: ORIGIN,
      fetchImpl,
    })) as any;
    assert.equal(sig, b64(payload));
    assert.deepEqual(JSON.parse(body), { payload: { endpoint_url: "https://api.example/x" } });
    assert.equal(out.result.status.state, "completed");
    assert.equal(out.result.status.message.metadata["x402.payment.status"], "payment-completed");
    assert.equal(out.result.status.message.metadata["x402.payment.receipts"][0].transaction, "0xabc");
    assert.equal(out.result.artifacts[0].parts[0].data.final_creditability_score, 820);
  });

  it("rejects unknown skills and methods", async () => {
    const fetchImpl = (async () => new Response("{}")) as unknown as typeof fetch;
    const bad = (await handleA2a(send({ skillId: "nope" }), { origin: ORIGIN, fetchImpl })) as any;
    assert.equal(bad.result.status.state, "failed");
    const m = (await handleA2a({ jsonrpc: "2.0", id: 2, method: "foo" }, { origin: ORIGIN, fetchImpl })) as any;
    assert.equal(m.error.code, -32601);
    const t = (await handleA2a({ jsonrpc: "2.0", id: 3, method: "tasks/get", params: { id: bad.result.id } }, { origin: ORIGIN, fetchImpl })) as any;
    assert.equal(t.result.id, bad.result.id);
  });
});
