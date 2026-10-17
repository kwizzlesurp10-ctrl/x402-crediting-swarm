import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildAgentCard } from "./agent-card.ts";

const ORIGIN = "https://x402-crediting-swarm.vercel.app";

describe("buildAgentCard", () => {
  it("returns required A2A fields without a message/send endpoint", () => {
    const card = buildAgentCard(ORIGIN);
    assert.equal(card.name, "x402 Crediting Swarm");
    assert.equal(card.url, `${ORIGIN}/api/swarm`);
    assert.equal(card.version, "0.1.0");
    assert.equal(card.protocolVersion, "0.3.0");
    assert.deepEqual(card.defaultInputModes, ["application/json"]);
    assert.deepEqual(card.defaultOutputModes, ["application/json"]);
    assert.ok(card.capabilities.extensions.length >= 1);
    assert.ok(card.skills.length >= 1);
    assert.equal(card.url.endsWith("/api/swarm"), true);
    assert.equal(
      card.skills.every((s) => !s.description.includes("message/send")),
      true,
    );
  });

  it("describes the paid swarm skill", () => {
    const card = buildAgentCard(ORIGIN);
    const skill = card.skills.find((s) => s.id === "evaluate-x402-payload");
    assert.ok(skill);
    assert.ok(skill.description.includes("/api/swarm"));
    assert.ok(skill.tags.includes("x402"));
  });
});
