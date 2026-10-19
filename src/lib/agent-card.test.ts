import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { A2A_X402_EXTENSION_URI, buildAgentCard, priceToAtomic } from "./agent-card.ts";

const ORIGIN = "https://x402-crediting-swarm.vercel.app";

describe("buildAgentCard", () => {
  it("points at the real A2A JSON-RPC endpoint", () => {
    const card = buildAgentCard(ORIGIN);
    assert.equal(card.name, "x402 Crediting Swarm");
    assert.equal(card.url, `${ORIGIN}/a2a`);
    assert.equal(card.preferredTransport, "JSONRPC");
    assert.equal(card.protocolVersion, "0.3.0");
    assert.deepEqual(card.supportedInterfaces, [
      { url: `${ORIGIN}/a2a`, protocolBinding: "JSONRPC", protocolVersion: "0.3" },
    ]);
    assert.equal(card.links.x402, `${ORIGIN}/.well-known/x402`);
    assert.equal(card.links.a2a, `${ORIGIN}/a2a`);
    assert.equal(card.provider.organization, "SEVTECH");
    assert.equal(card.securitySchemes.x402.name, "PAYMENT-SIGNATURE");
    assert.deepEqual(card.defaultInputModes, ["application/json"]);
    assert.equal(card.capabilities.extensions[0].uri, A2A_X402_EXTENSION_URI);
  });

  it("lists the paid skill with machine-readable x402 terms", () => {
    const card = buildAgentCard(ORIGIN);
    const skill = card.skills.find((s) => s.id === "evaluate-x402-payload");
    assert.ok(skill);
    assert.ok(skill.tags.includes("x402"));
    assert.ok(skill.examples.length >= 2);
    assert.ok(skill.examples.every((e) => typeof e === "string"));
    assert.equal(skill.x402.endpoint.url, `${ORIGIN}/api/swarm`);
    assert.equal(skill.x402.endpoint.method, "POST");
    assert.equal(skill.x402.assetSymbol, "USDC");
    assert.equal(skill.x402.scheme, "exact");
    assert.equal(skill.x402.amount, priceToAtomic(skill.x402.price));
    assert.equal(skill.x402.a2a.url, `${ORIGIN}/a2a`);
  });

  it("converts prices to USDC atomic units", () => {
    assert.equal(priceToAtomic("$0.05"), "50000");
    assert.equal(priceToAtomic("1.50"), "1500000");
  });
});
