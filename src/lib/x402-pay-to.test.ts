import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PAY_TO,
  formatPayToDisplay,
  resolveX402PayTo,
} from "./x402-pay-to.ts";

describe("resolveX402PayTo", () => {
  it("returns DEFAULT_PAY_TO when env is unset", () => {
    assert.equal(resolveX402PayTo(undefined), DEFAULT_PAY_TO);
    assert.equal(resolveX402PayTo(""), DEFAULT_PAY_TO);
    assert.equal(resolveX402PayTo("   "), DEFAULT_PAY_TO);
  });

  it("returns trimmed env override", () => {
    assert.equal(
      resolveX402PayTo("  0xabc  "),
      "0xabc",
    );
  });
});

describe("formatPayToDisplay", () => {
  it("truncates long addresses", () => {
    assert.equal(
      formatPayToDisplay(DEFAULT_PAY_TO, 20),
      "0x0d25A44f74868eCE53...",
    );
  });
});
