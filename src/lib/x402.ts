import "server-only";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import {
  CDP_FACILITATOR_URL,
  buildCdpCreateAuthHeaders,
  hasCdpCredentials,
} from "@/lib/cdp-auth";
import {
  DEFAULT_PAY_TO,
  EVAL_PRICE,
  SWARM_ROUTE_CONFIG,
  X402_NETWORK,
  X402_PAY_TO,
} from "@/lib/swarm-route-config";

export {
  DEFAULT_PAY_TO,
  EVAL_PRICE,
  SWARM_ROUTE_CONFIG,
  X402_NETWORK,
  X402_PAY_TO,
};

/** PayAI public facilitator — Base mainnet without CDP keys. */
export const PAYAI_FACILITATOR_URL = "https://facilitator.payai.network";

const CDP = hasCdpCredentials();

const MAINNET = X402_NETWORK === "eip155:8453";

export const FACILITATOR_KIND: "cdp" | "payai" | "x402.org" = CDP
  ? "cdp"
  : MAINNET
    ? "payai"
    : "x402.org";

export const X402_FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL ??
  (CDP
    ? CDP_FACILITATOR_URL
    : MAINNET
      ? PAYAI_FACILITATOR_URL
      : "https://x402.org/facilitator");

let server: x402ResourceServer | null = null;

export function getResourceServer(): x402ResourceServer {
  if (!server) {
    const facilitator = new HTTPFacilitatorClient({
      url: X402_FACILITATOR_URL,
      ...(CDP && process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET
        ? {
            createAuthHeaders: buildCdpCreateAuthHeaders(
              process.env.CDP_API_KEY_ID,
              process.env.CDP_API_KEY_SECRET,
              X402_FACILITATOR_URL,
            ),
          }
        : {}),
    });
    server = new x402ResourceServer(facilitator).register(
      X402_NETWORK,
      new ExactEvmScheme(),
    );
  }
  return server;
}

export function catalogEntry(resourceUrl: string) {
  return {
    resource: resourceUrl,
    type: "http",
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: X402_NETWORK,
        price: EVAL_PRICE,
        payTo: X402_PAY_TO,
      },
    ],
    description: SWARM_ROUTE_CONFIG.description,
    mimeType: "application/json",
  };
}
