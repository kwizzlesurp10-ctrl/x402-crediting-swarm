'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck, Zap, Activity, AlertTriangle, ArrowRight, DollarSign, Wallet } from 'lucide-react';
import { connectWallet, paidFetch } from '@/lib/wallet-pay';
import type { Address } from 'viem';

type NodeReport = {
  node: string;
  score: number;
  recommendation: string;
  flags?: string[];
  trust_level?: string;
};

type SwarmResult = {
  final_recommendation: string;
  final_creditability_score: number;
  trust_level: string;
  aggregated_flags: string[];
  node_reports: NodeReport[];
};

type PaymentChallenge = {
  x402Version?: number;
  error?: string;
  accepts?: Array<{
    scheme?: string;
    network?: string;
    amount?: string;
    asset?: string;
    payTo?: string;
    extra?: { name?: string };
  }>;
};

type Catalog = {
  price: string;
  network: string;
  payTo: string;
  facilitator: string;
};

function decodePaymentRequired(header: string | null): PaymentChallenge | null {
  if (!header) return null;
  try {
    const json = atob(header);
    return JSON.parse(json) as PaymentChallenge;
  } catch {
    try {
      return JSON.parse(header) as PaymentChallenge;
    } catch {
      return null;
    }
  }
}

const SAMPLE_PAYLOAD = {
  endpoint_url: "https://api.decentralized-catalog.market/v1/resource",
  vendor_id: "vendor_crypto_993x",
  requested_amount_sats: 500,
  vendor_history: {
    fulfillment_rate: 0.98,
    dispute_ratio: 0.01
  }
};

export default function Home() {
  const [payload, setPayload] = useState(JSON.stringify(SAMPLE_PAYLOAD, null, 2));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SwarmResult | null>(null);
  const [challenge, setChallenge] = useState<PaymentChallenge | null>(null);
  const [error, setError] = useState('');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [account, setAccount] = useState<Address | null>(null);

  useEffect(() => {
    fetch('/api/swarm')
      .then((res) => res.json())
      .then((data) =>
        setCatalog({
          price: data.price,
          network: data.network,
          payTo: data.payTo,
          facilitator: data.facilitator,
        }),
      )
      .catch(() => undefined);
  }, []);

  const run = async (fetcher: typeof fetch, callerId: string) => {
    const parsedPayload = JSON.parse(payload);
    const res = await fetcher('/api/swarm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caller_id: callerId,
        payload: parsedPayload,
      }),
    });
    const paymentHeader =
      res.headers.get('PAYMENT-REQUIRED') ??
      res.headers.get('payment-required');
    if (res.status === 402) {
      setChallenge(decodePaymentRequired(paymentHeader) ?? {
        error: 'Payment Required',
        x402Version: 2,
      });
      return;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || "Failed to evaluate");
    setChallenge(null);
    setResult(data as SwarmResult);
  };

  const handleRunEvaluation = async () => {
    setError('');
    setLoading(true);
    setResult(null);
    setChallenge(null);
    try {
      await run(fetch, 'agent_web_001');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePayWithWallet = async () => {
    setError('');
    setLoading(true);
    try {
      const network = challenge?.accepts?.[0]?.network ?? catalog?.network ?? 'eip155:84532';
      const addr = account ?? await connectWallet(network);
      setAccount(addr);
      const fetcher = await paidFetch(network, addr);
      await run(fetcher, `wallet_${addr.slice(0, 10)}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const accept = challenge?.accepts?.[0];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 p-8 font-sans selection:bg-cyan-900">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex items-center justify-between border-b border-neutral-800 pb-6">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-cyan-400" />
            <h1 className="text-2xl font-bold tracking-tight">x402 Crediting Swarm</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-neutral-400">
            {catalog && (
              <span className="font-mono text-xs">
                {catalog.network} · {catalog.facilitator} · {catalog.price}
              </span>
            )}
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <span>Swarm Status: <span className="text-emerald-400">Online</span></span>
            </div>
          </div>
        </header>

        <main className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <ArrowRight className="w-5 h-5 text-neutral-500" />
                Input Payload
              </h2>
              <p className="text-sm text-neutral-400 mb-4">
                Paste the x402 (Payment Required) payload below. The swarm will evaluate the vendor history and transaction risk.
              </p>
              <textarea
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                className="w-full h-64 bg-neutral-950 border border-neutral-800 rounded-lg p-4 font-mono text-sm text-cyan-50 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                spellCheck={false}
              />
            </section>

            <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                x402 Fee Gate
              </h2>
              {challenge ? (
                <div className="space-y-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-300 font-medium">
                    <AlertTriangle className="w-5 h-5" />
                    HTTP 402 Payment Required
                  </div>
                  <p className="text-sm text-neutral-400">
                    Pay with <span className="text-cyan-300">AgentCash</span> (canonical agent buyer),
                    or sign EIP-3009 from an injected wallet.
                  </p>
                  <pre className="text-[11px] leading-relaxed bg-neutral-950 border border-neutral-800 rounded-lg p-3 overflow-x-auto text-cyan-100 whitespace-pre-wrap">{`npx agentcash@latest fetch ${typeof window !== "undefined" ? window.location.origin : ""}/api/swarm \\
  -m POST --payment-network base --payment-protocol x402 \\
  -b '{"caller_id":"agentcash","payload":${payload}}'`}</pre>
                  <dl className="grid grid-cols-2 gap-2 text-sm font-mono">
                    <dt className="text-neutral-500">network</dt>
                    <dd className="text-neutral-200 truncate">{accept?.network ?? "—"}</dd>
                    <dt className="text-neutral-500">asset</dt>
                    <dd className="text-neutral-200 truncate">{accept?.extra?.name ?? accept?.asset ?? "USDC"}</dd>
                    <dt className="text-neutral-500">amount</dt>
                    <dd className="text-neutral-200 truncate">{accept?.amount ?? "atomic units"}</dd>
                    <dt className="text-neutral-500">payTo</dt>
                    <dd className="text-neutral-200 truncate" title={accept?.payTo}>{accept?.payTo ?? "—"}</dd>
                  </dl>
                  <button
                    onClick={handlePayWithWallet}
                    disabled={loading}
                    className="w-full mt-2 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-900 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    <Wallet className="w-4 h-4" />
                    {account ? `Pay from ${account.slice(0, 6)}…${account.slice(-4)}` : "Pay with wallet"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 bg-neutral-950 border border-neutral-800 rounded-lg">
                  <div>
                    <div className="font-medium">Evaluation Fee</div>
                    <div className="text-sm text-neutral-400">
                      {catalog?.price ?? "$0.05"} USDC via HTTP 402
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-400 text-sm">
                    <ShieldCheck className="w-5 h-5 text-cyan-400" />
                    Protocol-gated
                  </div>
                </div>
              )}
            </section>

            <button
              onClick={handleRunEvaluation}
              disabled={loading}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
                loading ? 'bg-cyan-900/50 text-cyan-200 cursor-not-allowed'
                : 'bg-cyan-500 hover:bg-cyan-400 text-neutral-950 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Swarm Analyzing...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Initiate Swarm Evaluation
                </>
              )}
            </button>
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 min-h-[500px]">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-neutral-500" />
                Threat Intelligence Report
              </h2>
              
              {!result && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-neutral-500 py-32">
                  <ShieldAlert className="w-12 h-12 mb-4 opacity-50" />
                  <p>Awaiting payload evaluation...</p>
                </div>
              )}

              {loading && (
                <div className="space-y-4 animate-pulse">
                  <div className="h-24 bg-neutral-800 rounded-lg" />
                  <div className="h-12 bg-neutral-800 rounded-lg" />
                  <div className="grid grid-cols-3 gap-4">
                    <div className="h-32 bg-neutral-800 rounded-lg" />
                    <div className="h-32 bg-neutral-800 rounded-lg" />
                    <div className="h-32 bg-neutral-800 rounded-lg" />
                  </div>
                </div>
              )}

              {result && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className={`p-6 rounded-xl border ${result.final_recommendation === 'GO' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    <div className="flex items-end justify-between mb-2">
                      <div className="text-sm font-medium opacity-80">Consensus Score</div>
                      <div className={`text-4xl font-black ${result.final_recommendation === 'GO' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {result.final_creditability_score}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-lg">{result.final_recommendation}</div>
                      <div className="text-sm opacity-80">{result.trust_level}</div>
                    </div>
                  </div>

                  {result.aggregated_flags.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Detected Anomalies</h3>
                      <ul className="space-y-2">
                        {result.aggregated_flags.map((flag: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-300 p-3 rounded-lg text-sm">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            {flag}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Node Telemetry</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {result.node_reports.map((node: NodeReport, idx: number) => (
                        <div key={idx} className="bg-neutral-950 border border-neutral-800 p-4 rounded-lg">
                          <div className="text-xs text-neutral-500 font-mono mb-2 truncate" title={node.node}>{node.node}</div>
                          <div className="text-xl font-bold mb-1" style={{ color: node.score >= 800 ? '#34d399' : node.score >= 500 ? '#fbbf24' : '#f87171' }}>
                            {node.score}
                          </div>
                          <div className="text-xs text-neutral-400">{node.recommendation}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
