import "server-only";
import { createPrivateKey, randomBytes, sign as cryptoSign } from "node:crypto";

/** CDP hosted x402 facilitator (verify + settle). */
export const CDP_FACILITATOR_URL =
  "https://api.cdp.coinbase.com/platform/v2/x402";

const PKCS8_ED25519_PREFIX = Buffer.from(
  "302e020100300506032b657004220420",
  "hex",
);

const ENDPOINTS: Record<string, { method: string; suffix: string }> = {
  verify: { method: "POST", suffix: "/verify" },
  settle: { method: "POST", suffix: "/settle" },
  supported: { method: "GET", suffix: "/supported" },
};

function b64url(data: Buffer): string {
  return data.toString("base64url");
}

function loadEd25519Key(apiKeySecret: string) {
  const raw = Buffer.from(apiKeySecret, "base64");
  if (raw.length !== 32 && raw.length !== 64) {
    throw new Error(
      `CDP api_key_secret must decode to 32 or 64 bytes, got ${raw.length}`,
    );
  }
  const der = Buffer.concat([PKCS8_ED25519_PREFIX, raw.subarray(0, 32)]);
  return createPrivateKey({ key: der, format: "der", type: "pkcs8" });
}

export function generateCdpJwt(opts: {
  apiKeyId: string;
  apiKeySecret: string;
  method: string;
  host: string;
  path: string;
  expiresIn?: number;
}): string {
  const key = loadEd25519Key(opts.apiKeySecret);
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "EdDSA",
    typ: "JWT",
    kid: opts.apiKeyId,
    nonce: randomBytes(16).toString("hex"),
  };
  const payload = {
    sub: opts.apiKeyId,
    iss: "cdp",
    aud: ["cdp_service"],
    nbf: now,
    exp: now + (opts.expiresIn ?? 120),
    uri: `${opts.method} ${opts.host}${opts.path}`,
  };
  const signingInput = `${b64url(Buffer.from(JSON.stringify(header)))}.${b64url(Buffer.from(JSON.stringify(payload)))}`;
  const sig = cryptoSign(null, Buffer.from(signingInput), key);
  return `${signingInput}.${b64url(sig)}`;
}

export function buildCdpCreateAuthHeaders(
  apiKeyId: string,
  apiKeySecret: string,
  baseUrl: string,
) {
  const url = new URL(baseUrl);
  const host = url.host;
  const basePath = url.pathname.replace(/\/$/, "");

  return async () => {
    const headers: Record<string, Record<string, string>> = {};
    for (const [name, { method, suffix }] of Object.entries(ENDPOINTS)) {
      const token = generateCdpJwt({
        apiKeyId,
        apiKeySecret,
        method,
        host,
        path: `${basePath}${suffix}`,
      });
      headers[name] = { Authorization: `Bearer ${token}` };
    }
    return headers as {
      verify: Record<string, string>;
      settle: Record<string, string>;
      supported: Record<string, string>;
    };
  };
}

export function hasCdpCredentials(): boolean {
  return Boolean(
    process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET,
  );
}
