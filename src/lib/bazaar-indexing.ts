/**
 * Bazaar indexing helpers for the CDP facilitator.
 *
 * The CDP facilitator catalogs a resource when it settles a PaymentPayload that
 * carries `paymentPayload.resource` (absolute URL) plus the echoed
 * `paymentPayload.extensions.bazaar` declaration. Many buyers (wallet x402
 * pay tools, hand-rolled clients) only sign `accepted` and drop both, so the
 * settlement succeeds but nothing is indexed.
 *
 * Before settling we backfill whatever the buyer omitted from what this route
 * advertised in its own PAYMENT-REQUIRED challenge (never overwriting buyer
 * data), and after settling we read the facilitator's indexing outcome from
 * the `EXTENSION-RESPONSES` header (base64 JSON keyed by extension) and/or the
 * settle body's `extensions.bazaar`.
 *
 * Docs: https://docs.cdp.coinbase.com/x402/bazaar,
 *       https://docs.x402.org/extensions/bazaar
 */

export const BAZAAR_KEY = "bazaar";

export type ResourceInfoLike = {
  url: string;
  description?: string;
  mimeType?: string;
  serviceName?: string;
  tags?: string[];
};

export type PayloadLike = {
  resource?: unknown;
  extensions?: Record<string, unknown> | null;
  [k: string]: unknown;
};

export type BackfillResult = { resource: boolean; bazaar: boolean };

function isObj(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function hasAbsoluteUrl(resource: unknown): boolean {
  if (!isObj(resource) || typeof resource.url !== "string") return false;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(resource.url);
}

const ABSOLUTE = /^https?:\/\//i;

/** Same resource = same origin + path (query/fragment ignored). */
export function sameResource(a: string, b: string): boolean {
  try {
    const x = new URL(a);
    const y = new URL(b);
    return x.protocol === y.protocol && x.host === y.host && x.pathname.replace(/\/+$/, "") === y.pathname.replace(/\/+$/, "");
  } catch {
    return false;
  }
}

/**
 * Mutates `payload` in place: sets `resource` when the buyer left it out (or
 * sent it without an absolute URL) and `extensions.bazaar` when missing.
 * Buyer-supplied values are never replaced, and our bazaar declaration is only
 * attached when the payload's resource is this route's own advertised URL, so
 * a buyer cannot get our discovery metadata cataloged under a foreign URL.
 */
export function backfillDiscovery(
  payload: PayloadLike,
  advertised: { resource?: ResourceInfoLike | null; bazaar?: unknown },
): BackfillResult {
  const out: BackfillResult = { resource: false, bazaar: false };
  const res = advertised.resource;
  if (!res || !ABSOLUTE.test(res.url)) return out;
  if (!hasAbsoluteUrl(payload.resource)) {
    const clean: ResourceInfoLike = { url: res.url };
    if (res.description) clean.description = res.description;
    if (res.mimeType) clean.mimeType = res.mimeType;
    if (res.serviceName) clean.serviceName = res.serviceName;
    if (res.tags?.length) clean.tags = [...res.tags];
    payload.resource = clean;
    out.resource = true;
  }
  const payloadUrl = (payload.resource as { url: string }).url;
  if (!sameResource(payloadUrl, res.url)) return out;
  const exts = isObj(payload.extensions) ? payload.extensions : {};
  if (advertised.bazaar !== undefined && advertised.bazaar !== null && !isObj(exts[BAZAAR_KEY])) {
    payload.extensions = { ...exts, [BAZAAR_KEY]: structuredClone(advertised.bazaar) };
    out.bazaar = true;
  }
  return out;
}

export type BazaarIndexingStatus = {
  /** success | processing | rejected as reported by the facilitator; not_reported when absent. */
  status: "success" | "processing" | "rejected" | "not_reported" | string;
  rejectedReason?: string;
  source: "extension-responses-header" | "settle-body" | "none";
};

export function decodeExtensionResponses(header: string | null | undefined): Record<string, unknown> | null {
  if (!header) return null;
  try {
    const raw = header.trim().startsWith("{") ? header : Buffer.from(header.trim(), "base64").toString("utf8");
    const parsed = JSON.parse(raw);
    return isObj(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function pick(v: unknown, source: BazaarIndexingStatus["source"]): BazaarIndexingStatus | null {
  if (!isObj(v) || typeof v.status !== "string") return null;
  const s: BazaarIndexingStatus = { status: v.status, source };
  const reason = v.rejectedReason ?? v.reason;
  if (typeof reason === "string" && reason) s.rejectedReason = reason.slice(0, 500);
  return s;
}

export function bazaarIndexingStatus(opts: {
  extensionResponsesHeader?: string | null;
  settleBody?: unknown;
}): BazaarIndexingStatus {
  const fromHeader = pick(decodeExtensionResponses(opts.extensionResponsesHeader)?.[BAZAAR_KEY], "extension-responses-header");
  if (fromHeader) return fromHeader;
  const body = isObj(opts.settleBody) ? opts.settleBody : {};
  const fromBody = pick(isObj(body.extensions) ? body.extensions[BAZAAR_KEY] : undefined, "settle-body");
  if (fromBody) return fromBody;
  return { status: "not_reported", source: "none" };
}

/** One structured log line per settlement; no secrets, no signatures. */
export function bazaarIndexingLogLine(entry: {
  service: string;
  resourceUrl?: string;
  transaction?: string;
  payer?: string;
  backfilled: BackfillResult;
  indexing: BazaarIndexingStatus;
}): string {
  return `[x402] bazaar_indexing ${JSON.stringify(entry)}`;
}
