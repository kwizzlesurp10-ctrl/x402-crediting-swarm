'use client';

import { useState } from 'react';
import { ShieldAlert, ShieldCheck, Zap, Activity, AlertTriangle, ArrowRight, DollarSign } from 'lucide-react';

export default function Home() {
  const [payload, setPayload] = useState(JSON.stringify({
    endpoint_url: "https://api.decentralized-catalog.market/v1/resource",
    vendor_id: "vendor_crypto_993x",
    requested_amount_sats: 500,
    vendor_history: {
      fulfillment_rate: 0.98,
      dispute_ratio: 0.01
    }
  }, null, 2));
  
  const [feePaid, setFeePaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handlePayFee = () => {
    // In a production app, this would connect to a real micropayment provider
    // such as Stripe, Paddle, or a Lightning Network gateway.
    setFeePaid(true);
  };

  const handleRunEvaluation = async () => {
    if (!feePaid) {
      setError("Please pay the required x402 evaluation fee first.");
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const parsedPayload = JSON.parse(payload);
      const res = await fetch('/api/swarm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller_id: 'agent_web_001',
          payload: parsedPayload,
          fee_paid: feePaid
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Failed to evaluate");
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 p-8 font-sans selection:bg-cyan-900">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex items-center justify-between border-b border-neutral-800 pb-6">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-cyan-400" />
            <h1 className="text-2xl font-bold tracking-tight">x402 Crediting Swarm</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <Activity className="w-4 h-4" />
            <span>Swarm Status: <span className="text-emerald-400">Online</span></span>
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
                Fee Gate
              </h2>
              <div className="flex items-center justify-between p-4 bg-neutral-950 border border-neutral-800 rounded-lg">
                <div>
                  <div className="font-medium">Evaluation Fee</div>
                  <div className="text-sm text-neutral-400">0.05 USD / 500 Sats</div>
                </div>
                {feePaid ? (
                  <div className="flex items-center gap-2 text-emerald-400 font-medium bg-emerald-400/10 px-4 py-2 rounded-lg">
                    <ShieldCheck className="w-5 h-5" />
                    Paid
                  </div>
                ) : (
                  <button
                    onClick={handlePayFee}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Pay Fee
                  </button>
                )}
              </div>
            </section>

            <button
              onClick={handleRunEvaluation}
              disabled={loading || !feePaid}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
                loading ? 'bg-cyan-900/50 text-cyan-200 cursor-not-allowed'
                : !feePaid ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
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
                      {result.node_reports.map((node: any, idx: number) => (
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
