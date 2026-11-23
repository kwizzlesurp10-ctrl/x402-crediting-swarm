import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { populatePaymentRequiredBody } from "./x402-response.ts";

describe("populatePaymentRequiredBody", () => {
  it("populates decoded x402 v2 JSON body on 402 while preserving PAYMENT-REQUIRED byte-for-byte", async () => {
    const challenge = {
      x402Version: 2,
      error: "Payment required",
      resource: {
        url: "https://x402-crediting-swarm.vercel.app/api/swarm",
        mimeType: "application/json",
      },
      accepts: [
        {
          scheme: "exact",
          network: "eip155:8453",
          amount: "50000",
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          payTo: "0x0d25a44f74868ece53b305c97139cf4b62963410",
          maxTimeoutSeconds: 300,
          extra: { name: "USD Coin", version: "2" },
        },
      ],
    };
    const encoded = Buffer.from(JSON.stringify(challenge), "utf8").toString("base64");
    const upstream = new Response("{}", {
      status: 402,
      headers: {
        "PAYMENT-REQUIRED": encoded,
        "Content-Type": "application/json",
      },
    });

    const out = await populatePaymentRequiredBody(upstream);
    assert.equal(out.status, 402);
    assert.equal(out.headers.get("payment-required"), encoded);
    assert.equal(out.headers.get("access-control-allow-origin"), "*");
    const body = await out.json();
    assert.deepEqual(body, challenge);
  });

  it("passes non-402 responses through untouched", async () => {
    const okRes = new Response(JSON.stringify({ status: "success" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const out = await populatePaymentRequiredBody(okRes);
    assert.equal(out, okRes);
  });
});
