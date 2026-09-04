# x402 Crediting Swarm

Three-node swarm (Alpha, Beta, Gamma) that scores **x402 Payment Required** calls so agentic clients can decide GO / NO-GO before they pay a catalog vendor.

Last commit shipped a Next.js console with **real Gemini evaluation and no mocked scores**. The leftover mock — a client-side “Pay Fee” boolean the server trusted — is gone. `POST /api/swarm` is now a real x402 resource: unpaid requests get HTTP **402** with a `PAYMENT-REQUIRED` challenge; paid requests settle through a facilitator, then the three nodes run.

## Mission

Protect agentic buyers from fraudulent micropayment requests. Given an x402 payload plus marketplace metadata, the swarm returns:

1. Endpoint identity & reputation verification
2. Transaction risk assessment
3. Credit score **0–1000** and a definitive GO / NO-GO

| Score | Trust | Recommendation |
|-------|-------|----------------|
| 800–1000 | High | GO — safe to auto-pay |
| 500–799 | Moderate | NO-GO (Caution) — confirm or escrow |
| 0–499 | Low / fraud | NO-GO — do not pay |

## HTTP surface

| Path | Auth | What |
|------|------|------|
| `GET /` | free | Operator console |
| `GET /openapi.json` | free | AgentCash OpenAPI 3.1 + `x-payment-info` |
| `GET /llms.txt` | free | Agent-oriented usage brief |
| `GET /api/swarm` | free | Resource catalog (price, network, payTo, body schema) |
| `POST /api/swarm` | **x402 $0.05 USDC** | Run Alpha + Beta + Gamma, return consensus report |
| `GET /.well-known/x402` | free | x402 catalog (legacy) |
| `GET /.well-known/funding.json` | free | payTo / network |

Unpaid `POST /api/swarm`:

```
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: <base64 x402 v2 JSON>
```

Retry with a signed `PAYMENT-SIGNATURE` (`@x402/fetch`, CDP `CdpX402Client`, or [x402-mcp](https://github.com/kwizzlesurp10-ctrl/x402-mcp) `x402.pay_and_fetch`).

Body:

```json
{
  "caller_id": "agent_web_001",
  "payload": {
    "endpoint_url": "https://api.example/v1/resource",
    "vendor_id": "vendor_crypto_993x",
    "requested_amount_sats": 500,
    "vendor_history": { "fulfillment_rate": 0.98, "dispute_ratio": 0.01 }
  }
}
```

## Local

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Click **Initiate Swarm Evaluation** — you should see a **402**, not a fake Paid badge. That is success for the unpaid path.

**Canonical buyer is [AgentCash](https://agentcash.dev)** — agents pay the 402 with the operator wallet, no API keys:

```bash
npx agentcash@latest fetch http://localhost:3000/api/swarm \
  -m POST --payment-network base --payment-protocol x402 \
  -b '{"caller_id":"agentcash","payload":{"endpoint_url":"https://example/v1"}}'
```

Validate discovery:

```bash
npx -y @agentcash/discovery@latest discover http://localhost:3000
npx agentcash@latest discover http://localhost:3000
```

Public listings (after a Railway HTTPS domain is live):

```bash
npx agentcash@latest register https://YOUR-SERVICE.up.railway.app
```

[x402scan register](https://www.x402scan.com/resources/register) · [mppscan register](https://www.mppscan.com/register) after adding MPP.

Humans can still **Pay with wallet** (injected EIP-1193) to sign the EIP-3009 USDC authorization.

The swarm itself spends AgentCash USDC on live x402 intel before scoring:

| Source | Call | Price |
|--------|------|-------|
| SYNTHORA preflight | `POST https://x402meta.hergertsynthora.com/service` | $0.01 |
| Market Intel payment risk | `POST …/v1/x402/payment_risk` | $0.01 |
| Market Intel seller score | `POST …/v1/x402/seller_score` | $0.05 |

If the AgentCash wallet is empty, nodes **must not invent** Bazaar/payTo facts — they flag `insufficient_balance` instead. Operator buyer is the x402-mcp hot wallet [`0xc22c17Fca624dB679B2471f2Bb099E1E29a46209`](https://agentcash.dev/deposit/0xc22c17Fca624dB679B2471f2Bb099E1E29a46209?network=base). That spend key stays local; the Railway seller only has `X402_PAY_TO_ADDRESS`.

Gemini needs `GOOGLE_GENERATIVE_AI_API_KEY`. Settlement needs a facilitator that supports the configured network.

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | — | Required for node evaluation after payment |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Google model id (`gemini-1.5-flash` is retired) |
| `X402_PAY_TO_ADDRESS` | `0x8A897D546c22d726b45Fa25F0EBB56207E63fF4e` | Same payTo as x402-mcp |
| `X402_EVAL_PRICE` | `$0.05` | Dollar string; USDC on the network |
| `X402_NETWORK` | auto | `eip155:8453` when CDP keys are set, else Base Sepolia `eip155:84532`. Public listings need mainnet. |
| `X402_FACILITATOR_URL` | auto | CDP when keys are set; PayAI (`https://facilitator.payai.network`) on mainnet without CDP; else `https://x402.org/facilitator` |
| `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` | — | Ed25519 JWT auth for Coinbase CDP facilitator (same as x402-mcp) |
| `BASE_URL` / `PUBLIC_ORIGIN` | Railway public URL | Canonical HTTPS origin for OpenAPI `servers` and 402 `resource.url` |

Set the CDP keys to sell/settle on **Base mainnet**. The public host should never hold a spend key.

## Swarm config

Node roles and the shared system prompt live in [`swarm.yaml`](swarm.yaml). The API route inlines the same prompt so Alpha / Beta / Gamma stay aligned with the YAML.

## Related

- Protocol: [x402](https://x402.org)
- Seller/buyer MCP already live on Base: [kwizzlesurp10-ctrl/x402-mcp](https://github.com/kwizzlesurp10-ctrl/x402-mcp)
