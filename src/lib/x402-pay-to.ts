/** Same payTo used by x402-mcp on Base. Override with X402_PAY_TO_ADDRESS on the server. */
export const DEFAULT_PAY_TO =
  "0x0d25A44f74868eCE53B305C97139CF4B62963410" as const;

export function resolveX402PayTo(
  payToAddressFromEnv?: string,
): typeof DEFAULT_PAY_TO | string {
  const trimmed = payToAddressFromEnv?.trim();
  if (trimmed) return trimmed;
  return DEFAULT_PAY_TO;
}

export function formatPayToDisplay(payTo: string, head = 20, tail = 0): string {
  if (payTo.length <= head + tail + 3) return payTo;
  if (tail <= 0) return `${payTo.slice(0, head)}...`;
  return `${payTo.slice(0, head)}...${payTo.slice(-tail)}`;
}
