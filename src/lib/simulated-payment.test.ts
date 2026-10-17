import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSimulatedPaymentRequest, simulatedPaymentsAllowed } from "./simulated-payment.ts";

describe("simulated payment bypass", () => {
  it("is never allowed on Vercel production, even if the flag is set", () => {
    assert.equal(simulatedPaymentsAllowed({ allow: "true", vercelEnv: "production", nodeEnv: "production" }), false);
  });
  it("is off by default on previews and prod builds", () => {
    assert.equal(simulatedPaymentsAllowed({ vercelEnv: "preview", nodeEnv: "production" }), false);
    assert.equal(simulatedPaymentsAllowed({ nodeEnv: "production" }), false);
  });
  it("can be enabled on non-production, and works in local dev", () => {
    assert.equal(simulatedPaymentsAllowed({ allow: "true", vercelEnv: "preview" }), true);
    assert.equal(simulatedPaymentsAllowed({ nodeEnv: "development" }), true);
  });
  it("detects simulated requests", () => {
    assert.equal(isSimulatedPaymentRequest({ fee_paid: true }, null), true);
    assert.equal(isSimulatedPaymentRequest({}, "simulated-abc"), true);
    assert.equal(isSimulatedPaymentRequest({ payload: {} }, "eyJ4NDAy"), false);
  });
});
