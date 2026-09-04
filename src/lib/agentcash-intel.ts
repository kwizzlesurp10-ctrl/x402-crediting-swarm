import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type IntelCall = {
  source: string;
  url: string;
  ok: boolean;
  paid?: boolean;
  data?: unknown;
  error?: string;
};

export type AgentcashIntel = {
  funded: boolean;
  calls: IntelCall[];
};

type Payload = {
  endpoint_url?: unknown;
  payTo?: unknown;
  pay_to?: unknown;
  vendor_id?: unknown;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function agentcashFetch(opts: {
  url: string;
  method: "GET" | "POST";
  body?: Record<string, unknown>;
  maxAmount: number;
  source: string;
}): Promise<IntelCall> {
  const args = [
    "--yes",
    "agentcash@latest",
    "fetch",
    opts.url,
    "-m",
    opts.method,
    "--format",
    "json",
    "--payment-network",
    "base",
    "--payment-protocol",
    "x402",
    "--max-amount",
    String(opts.maxAmount),
    "--timeout",
    "45000",
  ];
  if (opts.body) {
    args.push("-b", JSON.stringify(opts.body));
  }

  try {
    const { stdout } = await execFileAsync("npx", args, {
      timeout: 50_000,
      maxBuffer: 2_000_000,
      env: process.env,
    });
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    const failed = parsed.success === false || parsed.error;
    return {
      source: opts.source,
      url: opts.url,
      ok: !failed,
      paid: true,
      data: parsed,
      error: failed ? JSON.stringify(parsed.error ?? parsed) : undefined,
    };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; message?: string };
    const raw = execErr.stdout || execErr.stderr || execErr.message || String(err);
    let error = raw.slice(0, 800);
    try {
      const parsed = JSON.parse(execErr.stdout || "{}") as {
        error?: { message?: string; cause?: string };
        message?: string;
        cause?: string;
      };
      error =
        parsed.error?.message ||
        parsed.message ||
        parsed.cause ||
        error;
      if (parsed.cause === "insufficient_balance" || parsed.error?.cause === "insufficient_balance") {
        return {
          source: opts.source,
          url: opts.url,
          ok: false,
          paid: false,
          error: "insufficient_balance",
        };
      }
    } catch {
      if (/insufficient_balance|current balance is 0/i.test(raw)) {
        return {
          source: opts.source,
          url: opts.url,
          ok: false,
          paid: false,
          error: "insufficient_balance",
        };
      }
    }
    return { source: opts.source, url: opts.url, ok: false, paid: false, error };
  }
}

export async function gatherAgentcashIntel(payload: Payload): Promise<AgentcashIntel> {
  const endpointUrl = asString(payload.endpoint_url);
  const payTo = asString(payload.payTo) ?? asString(payload.pay_to);

  const jobs: Array<() => Promise<IntelCall>> = [];

  if (endpointUrl) {
    jobs.push(() =>
      agentcashFetch({
        source: "synthora_preflight",
        url: "https://x402meta.hergertsynthora.com/service",
        method: "POST",
        body: { endpoint_url: endpointUrl, ...(payTo ? { payTo } : {}) },
        maxAmount: 0.02,
      }),
    );
    jobs.push(() =>
      agentcashFetch({
        source: "market_intel_payment_risk",
        url: "https://x402-market-intel-mcp.mtree.workers.dev/v1/x402/payment_risk",
        method: "POST",
        body: { resource_url: endpointUrl, source: "x402-crediting-swarm" },
        maxAmount: 0.02,
      }),
    );
  } else if (payTo) {
    jobs.push(() =>
      agentcashFetch({
        source: "synthora_preflight",
        url: "https://x402meta.hergertsynthora.com/service",
        method: "POST",
        body: { payTo },
        maxAmount: 0.02,
      }),
    );
  }

  if (payTo || endpointUrl) {
    jobs.push(() =>
      agentcashFetch({
        source: "market_intel_seller_score",
        url: "https://x402-market-intel-mcp.mtree.workers.dev/v1/x402/seller_score",
        method: "POST",
        body: {
          ...(payTo ? { pay_to: payTo } : {}),
          ...(endpointUrl ? { resource: endpointUrl } : {}),
          source: "x402-crediting-swarm",
        },
        maxAmount: 0.06,
      }),
    );
  }

  const calls: IntelCall[] = [];
  for (const job of jobs) {
    const result = await job();
    calls.push(result);
    if (result.error === "insufficient_balance") break;
  }
  return { funded: calls.some((c) => c.ok), calls };
}

export function formatIntelForPrompt(intel: AgentcashIntel): string {
  if (intel.calls.length === 0) {
    return "No AgentCash intel was requested (payload had no endpoint_url or payTo).";
  }
  const unfunded = intel.calls.every(
    (c) => c.error === "insufficient_balance" || /insufficient/i.test(c.error ?? ""),
  );
  if (unfunded) {
    return `AgentCash operator wallet is unfunded (0 USDC). Do NOT invent CDP Bazaar listings, live payTo matches, or seller volume. Flag that live intel was skipped: insufficient_balance. Deposit: https://agentcash.dev/deposit/0xEd37c3c4b0F05eB326E819EDd6A14fe5DE1cE96D?network=base`;
  }
  return JSON.stringify(intel.calls, null, 2);
}
