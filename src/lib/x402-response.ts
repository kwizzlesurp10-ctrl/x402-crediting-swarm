/**
 * Mirrors the base64 `PAYMENT-REQUIRED` header onto the 402 JSON response body
 * so x402 scanners checking body + header consistency never see `envelope-header-only`.
 */
export async function populatePaymentRequiredBody(
  res: Response,
): Promise<Response> {
  if (res.status !== 402) {
    return res;
  }

  const encoded = res.headers.get("payment-required");
  if (!encoded) {
    return res;
  }

  let decoded: unknown;
  try {
    const jsonText = Buffer.from(encoded, "base64").toString("utf8");
    decoded = JSON.parse(jsonText);
  } catch {
    return res;
  }

  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
    return res;
  }

  const headers = new Headers(res.headers);
  headers.delete("content-length");
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set(
    "Access-Control-Expose-Headers",
    "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
  );

  return new Response(JSON.stringify(decoded), {
    status: 402,
    headers,
  });
}
