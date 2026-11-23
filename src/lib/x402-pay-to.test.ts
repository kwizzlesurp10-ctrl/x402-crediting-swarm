import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PAY_TO,
  RETIRED_X402_PAY_TO,
  formatPayToDisplay,
  isRetiredX402PayTo,
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

  it("rejects the retired payee (any casing)", () => {
    assert.throws(
      () => resolveX402PayTo(RETIRED_X402_PAY_TO),
      /retired payee/,
    );
    assert.throws(
      () => resolveX402PayTo(RETIRED_X402_PAY_TO.toLowerCase()),
      /retired payee/,
    );
  });

  it("default payTo is Keith's Base Account, not the retired address", () => {
    assert.equal(DEFAULT_PAY_TO, "0x0d25A44f74868eCE53B305C97139CF4B62963410");
    assert.equal(isRetiredX402PayTo(DEFAULT_PAY_TO), false);
    assert.equal(isRetiredX402PayTo(RETIRED_X402_PAY_TO), true);
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
