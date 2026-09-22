export type X402NetworkEnv = {
  x402Network?: string;
  hasCdpCredentials: boolean;
  vercelEnv?: string;
  nodeEnv?: string;
};

/**
 * Default x402 EVM network when X402_NETWORK is unset.
 * Production Vercel (and NODE_ENV=production off-Vercel) use Base mainnet + PayAI/CDP.
 * Local/preview defaults to Base Sepolia + x402.org facilitator.
 */
export function resolveDefaultX402Network(env: X402NetworkEnv): `${string}:${string}` {
  const explicit = env.x402Network?.trim();
  if (explicit) return explicit as `${string}:${string}`;
  if (env.hasCdpCredentials) return "eip155:8453";
  if (env.vercelEnv === "production") return "eip155:8453";
  if (env.nodeEnv === "production" && env.vercelEnv !== "preview") {
    return "eip155:8453";
  }
  return "eip155:84532";
}
