'use client';

import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Activity,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Mail,
  FileCode,
  CheckCircle2,
  Server,
  Send,
  RefreshCw,
  Layers,
  Key,
  Info,
  HelpCircle,
  Sparkles,
  Cpu,
  ExternalLink,
  Shield,
  Terminal
} from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'assessor' | 'agentmail' | 'protocol'>('assessor');

  // Swarm Assessor State
  const [payload, setPayload] = useState(JSON.stringify({
    endpoint_url: "https://api.decentralized-catalog.market/v1/resource",
    vendor_id: "vendor_crypto_993x",
    requested_amount_sats: 500,
    vendor_history: {
      fulfillment_rate: 0.98,
      dispute_ratio: 0.01
    }
  }, null, 2));

  const [paymentMode, setPaymentMode] = useState<'header' | 'simulated'>('simulated');
  const [feePaid, setFeePaid] = useState(true);
  const [customXPayment, setCustomXPayment] = useState('x402-signature-proof-0x25b8650b');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [raw402Response, setRaw402Response] = useState<any>(null);
  const [error, setError] = useState('');

  // AgentMail State
  const [inbox, setInbox] = useState<any[]>([]);
  const [mailLoading, setMailLoading] = useState(false);
  const [sendTo, setSendTo] = useState('all-agents@x402-mcp');
  const [sendSubject, setSendSubject] = useState('Swarm Security Notice: Threat Monitoring Active');
  const [sendBody, setSendBody] = useState('x402 Crediting Swarm is monitoring catalog endpoints. Standby for threat broadcasts.');
  const [sendPriority, setSendPriority] = useState<'normal' | 'urgent'>('normal');
  const [mailStatusMsg, setMailStatusMsg] = useState('');

  // Protocol State
  const [openapiSpec, setOpenapiSpec] = useState<any>(null);
  const [mcpManifest, setMcpManifest] = useState<any>(null);

  const fetchInbox = async () => {
    setMailLoading(true);
    try {
      const res = await fetch('/api/mailrail');
      const data = await res.json();
      if (data.inbox) {
        setInbox(data.inbox);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setMailLoading(false);
    }
  };

  const fetchSpecs = async () => {
    try {
      const [specRes, manifestRes] = await Promise.all([
        fetch('/openapi.json'),
        fetch('/.well-known/mcp.json')
      ]);
      setOpenapiSpec(await specRes.json());
      setMcpManifest(await manifestRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchInbox();
    fetchSpecs();
  }, []);

  const handlePayFee = () => {
    setFeePaid(true);
  };

  const handleRunEvaluation = async () => {
    setError('');
    setLoading(true);
    setResult(null);
    setRaw402Response(null);

    try {
      const parsedPayload = JSON.parse(payload);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (paymentMode === 'header' && customXPayment) {
        headers['X-PAYMENT'] = customXPayment;
      }

      const res = await fetch('/api/swarm', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          caller_id: 'agent_web_001',
          payload: parsedPayload,
          fee_paid: paymentMode === 'simulated' ? true : undefined
        })
      });

      if (res.status === 402) {
        let parsedPr: any = null;
        const prHeader = res.headers.get('payment-required');
        const wwwAuth = res.headers.get('www-authenticate');
        const encoded = prHeader || (wwwAuth?.startsWith('x402 ') ? wwwAuth.slice(5) : null);

        if (encoded) {
          try {
            parsedPr = JSON.parse(atob(encoded));
          } catch (e) {
            console.error("Failed to decode payment-required header", e);
          }
        }

        setRaw402Response(parsedPr || { x402Version: 2, error: "Payment required" });
        setError("HTTP 402 Payment Required: Micropayment header or fee payment required.");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to evaluate");
      }

      setResult(data);
      fetchInbox();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendAgentMail = async (e: React.FormEvent) => {
    e.preventDefault();
    setMailStatusMsg('');
    try {
      const res = await fetch('/api/mailrail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: sendTo,
          subject: sendSubject,
          body: sendBody,
          priority: sendPriority
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMailStatusMsg('✅ AgentMail message dispatched successfully!');
        setSendSubject('');
        setSendBody('');
        fetchInbox();
      } else {
        setMailStatusMsg(`❌ Failed: ${data.error}`);
      }
    } catch (err: any) {
      setMailStatusMsg(`❌ Error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-900 selection:text-indigo-100 relative overflow-x-hidden">
      {/* Background Ambient Glow Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8 relative z-10">

        {/* Top Header / Hero */}
        <header className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 rounded-2xl shadow-inner">
                <ShieldAlert className="w-9 h-9 text-indigo-400" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                    x402 Crediting Swarm
                  </h1>
                  <span className="text-xs font-mono font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-full">
                    v2.0 Standard
                  </span>
                </div>
                <p className="text-sm text-slate-400 max-w-2xl">
                  Autonomous 3-Node threat intelligence network protecting AI agents from fraudulent micropayment requests, with AgentMail threat alerts & MCP tool integration.
                </p>
              </div>
            </div>

            {/* Quick Status Badges */}
            <div className="flex flex-wrap items-center gap-3 border-t lg:border-t-0 border-slate-800 pt-4 lg:pt-0">
              <div className="flex items-center gap-2 text-xs bg-slate-950/80 border border-slate-800 px-3.5 py-2 rounded-xl">
                <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="text-slate-300">Swarm Status: <strong className="text-emerald-400 font-semibold">3 Nodes Online</strong></span>
              </div>
              <div className="flex items-center gap-2 text-xs bg-slate-950/80 border border-slate-800 px-3.5 py-2 rounded-xl text-slate-300">
                <Cpu className="w-4 h-4 text-indigo-400" />
                <span>Network: <strong className="text-indigo-300">Base Mainnet (8453)</strong></span>
              </div>
              <a
                href="/openapi.json"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-xs text-slate-300 hover:text-indigo-300 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 px-3.5 py-2 rounded-xl transition-all"
              >
                <FileCode className="w-4 h-4 text-indigo-400" />
                <span>OpenAPI Spec</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            </div>
          </div>
        </header>

        {/* User-Friendly Instructions Card */}
        <section className="bg-gradient-to-r from-indigo-950/40 via-slate-900/90 to-slate-900/90 border border-indigo-800/40 rounded-2xl p-5 shadow-lg">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-200 uppercase tracking-wide text-xs">How to test & evaluate x402 calls in 3 simple steps</h2>
                <span className="text-[11px] text-indigo-300 font-mono bg-indigo-900/30 px-2 py-0.5 rounded">Safe Sandbox</span>
              </div>
              <div className="grid sm:grid-cols-3 gap-3 text-slate-300 pt-1">
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                  <div className="font-semibold text-indigo-300 mb-1 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-indigo-500 text-slate-950 font-bold text-[10px] flex items-center justify-center">1</span>
                    Input x402 Call JSON
                  </div>
                  <p className="text-[11px] text-slate-400">Paste vendor endpoint details & payment amounts to assess risk.</p>
                </div>
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                  <div className="font-semibold text-emerald-300 mb-1 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px] flex items-center justify-center">2</span>
                    Select Payment Gate
                  </div>
                  <p className="text-[11px] text-slate-400">Use <strong>Simulated Fee</strong> mode (free instant run) or <strong>X-PAYMENT Header</strong> mode.</p>
                </div>
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                  <div className="font-semibold text-violet-300 mb-1 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-violet-500 text-slate-950 font-bold text-[10px] flex items-center justify-center">3</span>
                    Review Consensus Report
                  </div>
                  <p className="text-[11px] text-slate-400">View Node Alpha, Beta & Gamma scores + automated AgentMail threat alerts.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Navigation Tabs */}
        <nav className="flex flex-wrap gap-3 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('assessor')}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'assessor'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Swarm Threat Assessor</span>
          </button>

          <button
            onClick={() => setActiveTab('agentmail')}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'agentmail'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800/60'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>AgentMail Rail</span>
            <span className="ml-1 bg-indigo-500/20 text-indigo-300 text-xs px-2 py-0.5 rounded-full border border-indigo-500/30 font-mono">
              {inbox.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('protocol')}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'protocol'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>x402 & MCP Specs</span>
          </button>
        </nav>

        {/* TAB 1: SWARM ASSESSOR */}
        {activeTab === 'assessor' && (
          <main className="grid lg:grid-cols-12 gap-8">
            
            {/* Left Input Column (5 cols) */}
            <div className="lg:col-span-5 space-y-6">

              {/* Payload Box */}
              <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold flex items-center gap-2 text-slate-200">
                    <ArrowRight className="w-4 h-4 text-indigo-400" />
                    Target x402 Call Payload
                  </h2>
                  <span className="text-[11px] font-mono bg-slate-950 text-indigo-300 px-2.5 py-1 rounded-md border border-slate-800">
                    JSON Schema
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Paste the Payment Required details from the vendor endpoint. The 3 nodes will analyze identity, transaction volume, and routing.
                </p>
                <textarea
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  className="w-full h-60 bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-indigo-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  spellCheck={false}
                />
              </section>

              {/* x402 Payment Gate Control */}
              <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold flex items-center gap-2 text-slate-200">
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                      x402 Payment Gate
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">Evaluation fee: <strong>$0.05 / 50,000 micro-USDC</strong></p>
                  </div>

                  <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      onClick={() => setPaymentMode('simulated')}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                        paymentMode === 'simulated'
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Simulated Mode
                    </button>
                    <button
                      onClick={() => setPaymentMode('header')}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                        paymentMode === 'header'
                          ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      X-PAYMENT Header
                    </button>
                  </div>
                </div>

                {paymentMode === 'header' ? (
                  <div className="space-y-2 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                    <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-indigo-400" />
                      X-PAYMENT / PAYMENT-SIGNATURE Header Value:
                    </label>
                    <input
                      type="text"
                      value={customXPayment}
                      onChange={(e) => setCustomXPayment(e.target.value)}
                      placeholder="e.g. x402-signature-proof-0x..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-indigo-200 focus:outline-none focus:border-indigo-500"
                    />
                    <p className="text-[11px] text-slate-400">
                      💡 <em>Tip: Clear this header value to test the server's HTTP 402 Payment Required response.</em>
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-slate-200">Sandbox Auto-Pay Enabled</div>
                      <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        No real crypto required — instant evaluation
                      </div>
                    </div>
                    <span className="text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
                      Free Sandbox Mode
                    </span>
                  </div>
                )}
              </section>

              {/* Submit Button */}
              <button
                onClick={handleRunEvaluation}
                disabled={loading}
                className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 transition-all shadow-xl ${
                  loading
                    ? 'bg-indigo-950 text-indigo-300 cursor-not-allowed border border-indigo-800/40'
                    : 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white shadow-indigo-600/30'
                }`}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Executing 3-Node Consensus Evaluation...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 text-amber-300 fill-amber-300" />
                    <span>Run Swarm Threat Assessment</span>
                  </>
                )}
              </button>

              {/* Error Box */}
              {error && (
                <div className="p-4 bg-rose-950/40 border border-rose-800/50 rounded-2xl text-rose-200 text-xs flex items-start gap-3 shadow-lg">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
                  <div className="space-y-2">
                    <div className="font-semibold text-slate-100">{error}</div>
                    {raw402Response && (
                      <div className="space-y-1 font-mono text-[11px] bg-slate-950/90 p-3 rounded-xl border border-rose-900/50 text-slate-300">
                        <div><strong>x402Version:</strong> {raw402Response.x402Version || 2}</div>
                        <div><strong>PayTo:</strong> {raw402Response.accepts?.[0]?.payTo || raw402Response.payTo || "0x8A897D546c22d726b45Fa25F0EBB56207E63fF4e"}</div>
                        <div><strong>Price:</strong> {raw402Response.accepts?.[0]?.price || (raw402Response.accepts?.[0]?.amount ? `$${(Number(raw402Response.accepts[0].amount) / 1000000).toFixed(2)} USD (${raw402Response.accepts[0].amount} micro-USDC)` : "$0.05")}</div>
                        <div><strong>Network:</strong> {raw402Response.accepts?.[0]?.network || raw402Response.network || "eip155:84532"}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Results Column (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 min-h-[600px] flex flex-col justify-between shadow-2xl">
                <div>
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                    <h2 className="text-lg font-bold flex items-center gap-2.5 text-slate-100">
                      <Activity className="w-5 h-5 text-indigo-400" />
                      Threat Intelligence & Consensus Report
                    </h2>
                    {result && (
                      <span className="text-xs font-mono bg-emerald-500/10 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Evaluation Complete
                      </span>
                    )}
                  </div>

                  {!result && !loading && (
                    <div className="flex flex-col items-center justify-center text-slate-500 py-36 space-y-4">
                      <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                        <ShieldAlert className="w-12 h-12 opacity-30 text-indigo-400" />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-sm font-semibold text-slate-300">Awaiting Payload Evaluation</p>
                        <p className="text-xs text-slate-500 max-w-sm">Click "Run Swarm Threat Assessment" to execute concurrent analysis across Nodes Alpha, Beta, and Gamma.</p>
                      </div>
                    </div>
                  )}

                  {loading && (
                    <div className="space-y-6 animate-pulse py-8">
                      <div className="h-28 bg-slate-800/50 rounded-2xl" />
                      <div className="h-14 bg-slate-800/50 rounded-xl" />
                      <div className="grid grid-cols-3 gap-4">
                        <div className="h-32 bg-slate-800/50 rounded-xl" />
                        <div className="h-32 bg-slate-800/50 rounded-xl" />
                        <div className="h-32 bg-slate-800/50 rounded-xl" />
                      </div>
                    </div>
                  )}

                  {result && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      
                      {/* Overall Consensus Card */}
                      <div className={`p-6 rounded-2xl border backdrop-blur-md ${
                        result.final_recommendation.startsWith('GO') && !result.final_recommendation.includes('NO-GO')
                          ? 'bg-emerald-950/30 border-emerald-700/50 shadow-emerald-950/20'
                          : 'bg-rose-950/30 border-rose-700/50 shadow-rose-950/20'
                      }`}>
                        <div className="flex items-end justify-between mb-3">
                          <div>
                            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">Swarm Consensus Score</div>
                            <div className="text-sm font-medium text-slate-300">{result.trust_level}</div>
                          </div>
                          <div className={`text-5xl font-black ${
                            result.final_recommendation.startsWith('GO') && !result.final_recommendation.includes('NO-GO')
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}>
                            {result.final_creditability_score}<span className="text-base text-slate-500 font-normal">/1000</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 mt-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Final Recommendation:</span>
                            <span className={`font-bold px-3 py-1 rounded-lg text-xs ${
                              result.final_recommendation.startsWith('GO') && !result.final_recommendation.includes('NO-GO')
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}>
                              {result.final_recommendation}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            Caller: {result.caller_id}
                          </div>
                        </div>
                      </div>

                      {/* Detected Risk Flags */}
                      <div className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                          <span>Detected Risk Flags & Anomalies</span>
                          <span className="text-slate-500 font-mono text-[11px]">({result.aggregated_flags?.length || 0} Flags)</span>
                        </h3>

                        {result.aggregated_flags && result.aggregated_flags.length > 0 ? (
                          <ul className="space-y-2">
                            {result.aggregated_flags.map((flag: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-2.5 bg-rose-950/30 border border-rose-800/40 text-rose-200 p-3 rounded-xl text-xs">
                                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                <span>{flag}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="flex items-center gap-2.5 bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 p-3.5 rounded-xl text-xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>No risk flags or routing anomalies detected by consensus swarm.</span>
                          </div>
                        )}
                      </div>

                      {/* 3-Node Telemetry Grid */}
                      <div className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Node Telemetry Breakdown</h3>
                        <div className="grid sm:grid-cols-3 gap-3">
                          {result.node_reports?.map((node: any, idx: number) => (
                            <div key={idx} className="bg-slate-950/90 border border-slate-800 p-4 rounded-xl space-y-2">
                              <div className="text-[11px] text-indigo-300 font-mono truncate font-semibold" title={node.node}>
                                {node.node}
                              </div>
                              <div className="text-2xl font-extrabold" style={{ color: node.score >= 800 ? '#34d399' : node.score >= 500 ? '#fbbf24' : '#f87171' }}>
                                {node.score} <span className="text-xs font-normal text-slate-500">pts</span>
                              </div>
                              <div className="text-xs font-medium text-slate-300 truncate">{node.recommendation}</div>
                              {node.flags?.length > 0 && (
                                <div className="text-[10px] text-rose-300 bg-rose-950/40 border border-rose-900/50 p-1.5 rounded-md truncate">
                                  {node.flags.length} flag(s) raised
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}
                </div>

                {/* Footer Guidance */}
                <div className="border-t border-slate-800 pt-4 text-[11px] text-slate-500 flex justify-between items-center">
                  <span>Scores &lt; 500 automatically dispatch urgent AgentMail alerts</span>
                  <span className="font-mono">x402 Swarm Protocol</span>
                </div>
              </section>
            </div>

          </main>
        )}

        {/* TAB 2: AGENTMAIL RAIL */}
        {activeTab === 'agentmail' && (
          <main className="grid lg:grid-cols-12 gap-8">
            
            {/* Dispatch Panel (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2 text-slate-100">
                    <Send className="w-5 h-5 text-indigo-400" />
                    Dispatch AgentMail Notice
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Send inter-agent messages or post threat alert broadcasts to subscriber agents over the AgentMail rail.
                  </p>
                </div>

                <form onSubmit={handleSendAgentMail} className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">To (Recipient Agent ID)</label>
                    <input
                      type="text"
                      value={sendTo}
                      onChange={(e) => setSendTo(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-indigo-200 focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">Subject</label>
                    <input
                      type="text"
                      value={sendSubject}
                      onChange={(e) => setSendSubject(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-indigo-200 focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">Priority</label>
                    <select
                      value={sendPriority}
                      onChange={(e: any) => setSendPriority(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-indigo-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="normal">Normal Notice</option>
                      <option value="urgent">🚨 Urgent (Threat Broadcast)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">Message Body</label>
                    <textarea
                      value={sendBody}
                      onChange={(e) => setSendBody(e.target.value)}
                      className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/20"
                  >
                    Send AgentMail Message
                  </button>
                </form>

                {mailStatusMsg && (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-indigo-300">
                    {mailStatusMsg}
                  </div>
                )}
              </section>
            </div>

            {/* Inbox Panel (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl min-h-[550px]">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div>
                    <h2 className="text-lg font-bold flex items-center gap-2 text-slate-100">
                      <Mail className="w-5 h-5 text-indigo-400" />
                      AgentMail Inbox
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">Showing recent messages and automated swarm threat broadcasts.</p>
                  </div>
                  <button
                    onClick={fetchInbox}
                    disabled={mailLoading}
                    className="text-xs flex items-center gap-1.5 text-slate-400 hover:text-indigo-300 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${mailLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {inbox.length === 0 ? (
                    <div className="text-xs text-slate-500 text-center py-20">No AgentMail messages in inbox.</div>
                  ) : (
                    inbox.map((msg: any) => (
                      <div
                        key={msg.id}
                        className={`p-4 rounded-xl border space-y-2.5 transition-all ${
                          msg.priority === 'urgent'
                            ? 'bg-rose-950/20 border-rose-800/50 shadow-lg shadow-rose-950/20'
                            : 'bg-slate-950 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold ${
                            msg.priority === 'urgent'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                          }`}>
                            {msg.priority === 'urgent' ? '🚨 URGENT THREAT ALERT' : 'NORMAL NOTICE'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            {new Date(msg.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-100">{msg.subject}</div>
                        <div className="text-xs text-slate-300 font-mono bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/50 break-words">
                          {msg.body}
                        </div>
                        <div className="text-[10px] text-slate-500 flex justify-between border-t border-slate-800/60 pt-2 mt-2">
                          <span>From: <strong className="text-slate-400">{msg.from}</strong></span>
                          <span>To: <strong className="text-slate-400">{msg.to}</strong></span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

          </main>
        )}

        {/* TAB 3: PROTOCOL SPECS */}
        {activeTab === 'protocol' && (
          <main className="space-y-6">
            <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2 text-slate-100">
                  <Server className="w-5 h-5 text-indigo-400" />
                  x402 v2 Payment Requirements Specification
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Canonical payment rules and network configurations advertised to calling agents.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-4 font-mono text-xs">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-slate-500 text-[11px]">Network (CAIP-2)</div>
                  <div className="text-indigo-300 font-bold">eip155:8453 (Base Mainnet)</div>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-slate-500 text-[11px]">PayTo Receiver Address</div>
                  <div className="text-emerald-400 font-bold truncate">0x8A897D546c22d726b45Fa...</div>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-slate-500 text-[11px]">Price / Token Asset</div>
                  <div className="text-indigo-300 font-bold">$0.05 / USDC (Base)</div>
                </div>
              </div>
            </section>

            <div className="grid md:grid-cols-2 gap-6">
              <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-indigo-400" />
                    OpenAPI 3.0 Spec Preview
                  </h3>
                  <a href="/openapi.json" target="_blank" className="text-[11px] text-indigo-400 hover:underline">Full JSON</a>
                </div>
                <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-indigo-300 max-h-96 overflow-auto">
                  {openapiSpec ? JSON.stringify(openapiSpec, null, 2) : 'Loading OpenAPI Spec...'}
                </pre>
              </section>

              <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-indigo-400" />
                    MCP Agent Tools Manifest
                  </h3>
                  <a href="/.well-known/mcp.json" target="_blank" className="text-[11px] text-indigo-400 hover:underline">Full Manifest</a>
                </div>
                <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-indigo-300 max-h-96 overflow-auto">
                  {mcpManifest ? JSON.stringify(mcpManifest, null, 2) : 'Loading MCP Manifest...'}
                </pre>
              </section>
            </div>
          </main>
        )}

      </div>
    </div>
  );
}
