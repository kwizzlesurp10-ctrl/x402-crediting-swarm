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

/** true = the field was set or replaced with our canonical advertised value. */
export type BackfillResult = { resource: boolean; bazaar: boolean };

function isObj(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

const ABSOLUTE = /^https?:\/\//i;

function stableJson(v: unknown): string {
  return JSON.stringify(v, (_k, x) =>
    isObj(x) ? Object.fromEntries(Object.entries(x).sort(([p], [q]) => (p < q ? -1 : p > q ? 1 : 0))) : x,
  );
}

/**
 * Mutates `payload` in place so the settle request carries exactly the
 * `resource` and `extensions.bazaar` this route advertised in its own
 * PAYMENT-REQUIRED challenge.
 *
 * We settle with our own CDP credentials, so we are the authority for what
 * gets cataloged: a missing, relative, foreign, or altered buyer copy (other
 * URL, query/userinfo, serviceName, description, tags, iconUrl, or a different
 * bazaar block) is replaced by the canonical advertised value. A byte-equal
 * echo is left alone. Other extensions are kept. Neither field is covered by
 * the buyer's EIP-3009 signature, so this cannot change what is paid.
 */
export function backfillDiscovery(
  payload: PayloadLike,
  advertised: { resource?: ResourceInfoLike | null; bazaar?: unknown },
): BackfillResult {
  const out: BackfillResult = { resource: false, bazaar: false };
  const res = advertised.resource;
  if (!res || !ABSOLUTE.test(res.url)) return out;
  const canonical: ResourceInfoLike = { url: res.url };
  if (res.description) canonical.description = res.description;
  if (res.mimeType) canonical.mimeType = res.mimeType;
  if (res.serviceName) canonical.serviceName = res.serviceName;
  if (res.tags?.length) canonical.tags = [...res.tags];
  if (stableJson(payload.resource) !== stableJson(canonical)) {
    payload.resource = canonical;
    out.resource = true;
  }
  if (advertised.bazaar === undefined || advertised.bazaar === null) return out;
  const exts = isObj(payload.extensions) ? payload.extensions : {};
  if (stableJson(exts[BAZAAR_KEY]) !== stableJson(advertised.bazaar)) {
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
