import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SWARM_ROUTE_CONFIG } from "./swarm-route-config.ts";

function getBazaarExtension(): {
  info: { input: Record<string, unknown> };
  schema: { properties: { input: { properties: Record<string, unknown> } } };
} {
  const extensions = SWARM_ROUTE_CONFIG.extensions;
  assert.ok(extensions, "SWARM_ROUTE_CONFIG must declare extensions");
  const bazaar = extensions.bazaar as {
    info: { input: Record<string, unknown> };
    schema: { properties: { input: { properties: Record<string, unknown> } } };
  };
  assert.ok(bazaar, "bazaar extension must be present");
  return bazaar;
}

describe("SWARM_ROUTE_CONFIG bazaar discovery", () => {
  it("declares POST with JSON body payload for CDP validate", () => {
    const bazaar = getBazaarExtension();
    const input = bazaar.info.input;
    assert.equal(input.type, "http");
    assert.equal(input.method, "POST");
    assert.equal(input.bodyType, "json");
    const body = input.body as { payload?: { endpoint_url?: string } };
    assert.ok(body.payload, "example body must include payload");
    assert.equal(typeof body.payload.endpoint_url, "string");
  });

  it("requires method in bazaar JSON schema", () => {
    const bazaar = getBazaarExtension();
    const methodSchema = bazaar.schema.properties.input.properties.method as {
      enum?: string[];
    };
    assert.deepEqual(methodSchema.enum, ["POST", "PUT", "PATCH"]);
    assert.equal(bazaar.info.input.method, "POST");
  });

  it("includes service metadata on the route", () => {
    assert.equal(SWARM_ROUTE_CONFIG.serviceName, "x402 Crediting Swarm");
    assert.ok(SWARM_ROUTE_CONFIG.tags?.includes("x402"));
    assert.ok(
      (SWARM_ROUTE_CONFIG.description?.length ?? 0) >= 120,
      "description should document price and errors for Bazaar curation",
    );
  });
});
