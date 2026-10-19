import { HTTPFacilitatorClient } from "@x402/core/server";
import type { RouteConfig, x402ResourceServer } from "@x402/core/server";
import type { PaymentPayload, PaymentRequirements, SettleResponse } from "@x402/core/types";
import { FacilitatorTimeoutError, SettleError } from "@x402/core/types";
import {
  BAZAAR_KEY,
  backfillDiscovery,
  bazaarIndexingLogLine,
  bazaarIndexingStatus,
  type BackfillResult,
  type BazaarIndexingStatus,
  type ResourceInfoLike,
} from "./bazaar-indexing.ts";

type FacilitatorConfig = ConstructorParameters<typeof HTTPFacilitatorClient>[0];

export type IndexingRecord = {
  service: string;
  resourceUrl?: string;
  transaction?: string;
  payer?: string;
  backfilled: BackfillResult;
  indexing: BazaarIndexingStatus;
};

const backfills = new WeakMap<object, BackfillResult>();

/**
 * HTTPFacilitatorClient whose settle() also captures the facilitator's Bazaar
 * indexing outcome (EXTENSION-RESPONSES header or settle-body extensions),
 * logs it, and surfaces it on SettleResponse.extensions.bazaar so it travels
 * back to the buyer inside PAYMENT-RESPONSE (the per-payment receipt).
 * verify() and getSupported() are inherited unchanged.
 */
export class IndexingFacilitatorClient extends HTTPFacilitatorClient {
  private readonly serviceName: string;
  private readonly fetchImpl: typeof fetch;
  private readonly onRecord: (rec: IndexingRecord) => void;

  constructor(
    config: FacilitatorConfig,
    opts: { serviceName: string; fetchImpl?: typeof fetch; onRecord?: (rec: IndexingRecord) => void },
  ) {
    super(config);
    this.serviceName = opts.serviceName;
    this.fetchImpl = opts.fetchImpl ?? ((...a) => fetch(...a));
    this.onRecord = opts.onRecord ?? ((rec) => console.log(bazaarIndexingLogLine(rec)));
  }

  override async settle(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    const auth = await this.createAuthHeaders("settle");
    const headers = { "Content-Type": "application/json", ...auth.headers };
    const body = JSON.stringify(
      {
        x402Version: paymentPayload.x402Version,
        paymentPayload,
        paymentRequirements,
      },
      (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    );
    const signal = AbortSignal.timeout(this.timeoutMs);
    let response: Response;
    let text: string;
    try {
      response = await this.fetchImpl(`${this.url}/settle`, {
        method: "POST",
        headers,
        redirect: "follow",
        body,
        signal,
      });
      text = await response.text();
    } catch (error) {
      if (signal.aborted) throw new FacilitatorTimeoutError("settle", this.timeoutMs);
      throw error;
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Facilitator settle failed (${response.status}): ${text.slice(0, 300)}`);
    }
    const indexing = bazaarIndexingStatus({
      extensionResponsesHeader: response.headers.get("EXTENSION-RESPONSES"),
      settleBody: data,
    });
    const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
    const resource = paymentPayload.resource as ResourceInfoLike | undefined;
    const record: IndexingRecord = {
      service: this.serviceName,
      resourceUrl: resource?.url,
      transaction: typeof obj.transaction === "string" ? obj.transaction : undefined,
      payer: typeof obj.payer === "string" ? obj.payer : undefined,
      backfilled: backfills.get(paymentPayload) ?? { resource: false, bazaar: false },
      indexing,
    };
    try {
      this.onRecord(record);
    } catch {
      // logging must never affect settlement
    }
    if (!response.ok) {
      if ("success" in obj) throw new SettleError(response.status, obj as unknown as SettleResponse);
      throw new Error(`Facilitator settle failed (${response.status}): ${text.slice(0, 300)}`);
    }
    if (typeof obj.success !== "boolean" || typeof obj.transaction !== "string" || typeof obj.network !== "string") {
      throw new Error("Facilitator settle returned an invalid response");
    }
    const result = obj as unknown as SettleResponse;
    const exts = (result.extensions ?? {}) as Record<string, unknown>;
    if (exts[BAZAAR_KEY] === undefined) {
      result.extensions = { ...exts, [BAZAAR_KEY]: { ...indexing } };
    }
    return result;
  }
}

/** Resource the route advertised in PAYMENT-REQUIRED (same rules as @x402/core). */
export function advertisedResource(route: RouteConfig, requestUrl: string | undefined): ResourceInfoLike | null {
  let url = route.resource || requestUrl;
  if (!url) return null;
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    u.username = "";
    u.password = "";
    url = u.toString();
  } catch {
    return null;
  }
  return {
    url,
    description: route.description,
    mimeType: route.mimeType,
    serviceName: route.serviceName,
    tags: route.tags,
  };
}

/**
 * Before settle, make the buyer's PaymentPayload carry exactly the `resource`
 * and `extensions.bazaar` this route advertised (set when omitted, replaced
 * when foreign or altered) so CDP catalogs our listing with our metadata.
 */
export function registerDiscoveryBackfill(server: x402ResourceServer, route: RouteConfig): void {
  server.onBeforeSettle(async (ctx) => {
    const payload = ctx.paymentPayload as unknown as Parameters<typeof backfillDiscovery>[0];
    const tc = ctx.transportContext as { request?: { adapter?: { getUrl?: () => string } } } | undefined;
    const declared = (ctx.declaredExtensions ?? {}) as Record<string, unknown>;
    const result = backfillDiscovery(payload, {
      resource: advertisedResource(route, tc?.request?.adapter?.getUrl?.()),
      bazaar: declared[BAZAAR_KEY] ?? (route.extensions as Record<string, unknown> | undefined)?.[BAZAAR_KEY],
    });
    backfills.set(ctx.paymentPayload as object, result);
  });
}
