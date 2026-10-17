/* eslint-disable @typescript-eslint/no-explicit-any -- loosely typed x402 fixtures */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { x402ResourceServer } from "@x402/core/server";
import { SettleError } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import {
  backfillDiscovery,
  bazaarIndexingStatus,
  decodeExtensionResponses,
} from "./bazaar-indexing.ts";
import {
  IndexingFacilitatorClient,
  registerDiscoveryBackfill,
  type IndexingRecord,
} from "./indexing-facilitator.ts";
import { SWARM_ROUTE_CONFIG } from "./swarm-route-config.ts";

const URL_ = "https://x402-crediting-swarm.vercel.app/api/swarm";
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64");
const REQ = {
  scheme: "exact",
  network: "eip155:8453",
  amount: "50000",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  payTo: "0x0d25A44f74868eCE53B305C97139CF4B62963410",
  maxTimeoutSeconds: 300,
  extra: { name: "USD Coin", version: "2" },
} as any;

function buyerPayload(extra: Record<string, unknown> = {}): any {
  return {
    x402Version: 2,
    accepted: REQ,
    payload: { signature: "0xsig", authorization: { from: "0xabc", to: REQ.payTo, value: "50000" } },
    ...extra,
  };
}

function fakeFetch(opts: { status?: number; body: unknown; header?: string }) {
  const calls: { url: string; body: any }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    const headers = new Headers({ "content-type": "application/json" });
    if (opts.header) headers.set("EXTENSION-RESPONSES", opts.header);
    return new Response(JSON.stringify(opts.body), { status: opts.status ?? 200, headers });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const OK = { success: true, transaction: "0xtx", network: "eip155:8453", payer: "0xabc" };

describe("backfillDiscovery", () => {
  const bazaar = (SWARM_ROUTE_CONFIG.extensions as any).bazaar;
  const resource = { url: URL_, description: "d", mimeType: "application/json", serviceName: "x402 Crediting Swarm", tags: ["x402"] };

  it("adds resource and extensions.bazaar when the buyer omitted them", () => {
    const p = buyerPayload();
    const r = backfillDiscovery(p, { resource, bazaar });
    assert.deepEqual(r, { resource: true, bazaar: true });
    assert.equal(p.resource.url, URL_);
    assert.equal(p.resource.serviceName, "x402 Crediting Swarm");
    assert.deepEqual(p.extensions.bazaar, bazaar);
    assert.notEqual(p.extensions.bazaar, bazaar, "must be a copy, not the shared route object");
  });

  it("never overwrites buyer-supplied resource or bazaar", () => {
    const mine = { url: "https://buyer.example/x" };
    const p = buyerPayload({ resource: mine, extensions: { bazaar: { info: { mine: true } }, other: 1 } });
    const r = backfillDiscovery(p, { resource, bazaar });
    assert.deepEqual(r, { resource: false, bazaar: false });
    assert.equal(p.resource, mine);
    assert.deepEqual(p.extensions, { bazaar: { info: { mine: true } }, other: 1 });
  });

  it("replaces a relative resource url and keeps other extensions", () => {
    const p = buyerPayload({ resource: { url: "/api/swarm" }, extensions: { other: 1 } });
    backfillDiscovery(p, { resource, bazaar });
    assert.equal(p.resource.url, URL_);
    assert.equal(p.extensions.other, 1);
    assert.ok(p.extensions.bazaar);
  });

  it("does not invent a relative advertised url", () => {
    const p = buyerPayload();
    const r = backfillDiscovery(p, { resource: { url: "/api/swarm" }, bazaar: undefined });
    assert.deepEqual(r, { resource: false, bazaar: false });
    assert.equal(p.resource, undefined);
  });
});

describe("bazaarIndexingStatus", () => {
  it("reads EXTENSION-RESPONSES (base64 JSON)", () => {
    assert.deepEqual(
      bazaarIndexingStatus({ extensionResponsesHeader: b64({ bazaar: { status: "processing" } }) }),
      { status: "processing", source: "extension-responses-header" },
    );
    assert.deepEqual(
      bazaarIndexingStatus({ extensionResponsesHeader: b64({ bazaar: { status: "rejected", rejectedReason: "info failed schema validation" } }) }),
      { status: "rejected", rejectedReason: "info failed schema validation", source: "extension-responses-header" },
    );
  });
  it("falls back to settle body extensions.bazaar, then not_reported", () => {
    assert.equal(bazaarIndexingStatus({ settleBody: { extensions: { bazaar: { status: "success" } } } }).status, "success");
    assert.deepEqual(bazaarIndexingStatus({ settleBody: OK }), { status: "not_reported", source: "none" });
    assert.equal(decodeExtensionResponses("not-base64-json"), null);
  });
});

describe("IndexingFacilitatorClient.settle", () => {
  it("posts the payload, records and returns the indexing status", async () => {
    const { impl, calls } = fakeFetch({ body: OK, header: b64({ bazaar: { status: "processing" } }) });
    const recs: IndexingRecord[] = [];
    const c = new IndexingFacilitatorClient({ url: "https://fac.test/x402" }, { serviceName: "svc", fetchImpl: impl, onRecord: (r) => recs.push(r) });
    const p = buyerPayload({ resource: { url: URL_ } });
    const res = await c.settle(p, REQ);
    assert.equal(calls[0]!.url, "https://fac.test/x402/settle");
    assert.equal(calls[0]!.body.paymentPayload.resource.url, URL_);
    assert.deepEqual(calls[0]!.body.paymentRequirements, REQ);
    assert.equal(res.transaction, "0xtx");
    assert.deepEqual((res.extensions as any).bazaar, { status: "processing", source: "extension-responses-header" });
    assert.equal(recs[0]!.indexing.status, "processing");
    assert.equal(recs[0]!.resourceUrl, URL_);
    assert.equal(recs[0]!.transaction, "0xtx");
  });

  it("keeps a facilitator-provided extensions.bazaar and reports not_reported when absent", async () => {
    const withBody = fakeFetch({ body: { ...OK, extensions: { bazaar: { status: "success" } } } });
    const c1 = new IndexingFacilitatorClient({ url: "https://fac.test" }, { serviceName: "s", fetchImpl: withBody.impl, onRecord: () => {} });
    assert.deepEqual(((await c1.settle(buyerPayload(), REQ)).extensions as any).bazaar, { status: "success" });
    const none = fakeFetch({ body: OK });
    const c2 = new IndexingFacilitatorClient({ url: "https://fac.test" }, { serviceName: "s", fetchImpl: none.impl, onRecord: () => {} });
    assert.equal(((await c2.settle(buyerPayload(), REQ)).extensions as any).bazaar.status, "not_reported");
  });

  it("throws SettleError on a failed settle body, still recording", async () => {
    const { impl } = fakeFetch({ status: 400, body: { success: false, errorReason: "invalid_payload", transaction: "", network: "eip155:8453" } });
    const recs: IndexingRecord[] = [];
    const c = new IndexingFacilitatorClient({ url: "https://fac.test" }, { serviceName: "s", fetchImpl: impl, onRecord: (r) => recs.push(r) });
    await assert.rejects(c.settle(buyerPayload(), REQ), (e: unknown) => e instanceof SettleError);
    assert.equal(recs.length, 1);
  });
});

describe("registerDiscoveryBackfill + x402ResourceServer.settlePayment", () => {
  it("the facilitator receives resource + bazaar the buyer omitted", async () => {
    const { impl, calls } = fakeFetch({ body: OK, header: b64({ bazaar: { status: "processing" } }) });
    const recs: IndexingRecord[] = [];
    const client = new IndexingFacilitatorClient({ url: "https://fac.test" }, { serviceName: "x402-crediting-swarm", fetchImpl: impl, onRecord: (r) => recs.push(r) });
    const server = new x402ResourceServer(client).register("eip155:8453", new ExactEvmScheme());
    registerDiscoveryBackfill(server, SWARM_ROUTE_CONFIG);
    const declared = SWARM_ROUTE_CONFIG.extensions as Record<string, unknown>;
    const transportContext = { request: { adapter: { getUrl: () => URL_ } } };
    const res = await server.settlePayment(buyerPayload(), REQ, declared, transportContext);
    assert.equal(res.success, true);
    const sent = calls[0]!.body.paymentPayload;
    assert.equal(sent.resource.url, URL_);
    assert.equal(sent.resource.serviceName, SWARM_ROUTE_CONFIG.serviceName);
    assert.deepEqual(sent.extensions.bazaar, declared.bazaar);
    assert.deepEqual(recs[0]!.backfilled, { resource: true, bazaar: true });
    assert.equal((res.extensions as any).bazaar.status, "processing");
  });
});
