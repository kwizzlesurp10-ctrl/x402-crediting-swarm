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
  Key
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

  const [paymentMode, setPaymentMode] = useState<'header' | 'simulated'>('header');
  const [feePaid, setFeePaid] = useState(false);
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
          fee_paid: paymentMode === 'simulated' ? feePaid : undefined
        })
      });

      const data = await res.json();

      if (res.status === 402) {
        setRaw402Response(data);
        setError("HTTP 402 Payment Required: Micropayment header or fee payment required.");
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to evaluate");
      }

      setResult(data);
      // Refresh AgentMail inbox as low scores auto-dispatch threat alerts
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
    <div className="min-h-screen bg-neutral-950 text-neutral-50 p-6 font-sans selection:bg-cyan-900">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-neutral-800 pb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
              <ShieldAlert className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">x402 Crediting Swarm</h1>
                <span className="text-xs font-mono bg-neutral-800 text-cyan-400 px-2 py-0.5 rounded-full border border-neutral-700">v2.0.0</span>
              </div>
              <p className="text-xs text-neutral-400">3-Node Threat Assessment & AgentMail Rail for x402 Micropayments</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-lg">
              <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>Swarm: <strong className="text-emerald-400">3 Nodes Online</strong></span>
            </div>
            <a
              href="/openapi.json"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-cyan-400 border border-neutral-800 hover:border-cyan-800 bg-neutral-900 px-3 py-1.5 rounded-lg transition-colors"
            >
              <FileCode className="w-3.5 h-3.5" />
              OpenAPI
            </a>
          </div>
        </header>

        {/* Navigation Tabs */}
        <nav className="flex gap-2 border-b border-neutral-800 pb-2">
          <button
            onClick={() => setActiveTab('assessor')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'assessor'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Swarm Assessor
          </button>

          <button
            onClick={() => setActiveTab('agentmail')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'agentmail'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <Mail className="w-4 h-4" />
            AgentMail Rail ({inbox.length})
          </button>

          <button
            onClick={() => setActiveTab('protocol')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'protocol'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            x402 v2 & MCP Specs
          </button>
        </nav>

        {/* TAB 1: SWARM ASSESSOR */}
        {activeTab === 'assessor' && (
          <main className="grid md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-cyan-400" />
                    Input x402 Payload
                  </h2>
                  <span className="text-xs text-neutral-500 font-mono">JSON</span>
                </div>
                <textarea
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  className="w-full h-64 bg-neutral-950 border border-neutral-800 rounded-lg p-4 font-mono text-xs text-cyan-300 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  spellCheck={false}
                />
              </section>

              {/* x402 Micropayment Gate */}
              <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    x402 Payment Gate ($0.05 / 500 Sats)
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPaymentMode('header')}
                      className={`text-xs px-2.5 py-1 rounded-md transition-colors ${paymentMode === 'header' ? 'bg-cyan-500 text-neutral-950 font-bold' : 'bg-neutral-800 text-neutral-400'}`}
                    >
                      X-PAYMENT Header
                    </button>
                    <button
                      onClick={() => setPaymentMode('simulated')}
                      className={`text-xs px-2.5 py-1 rounded-md transition-colors ${paymentMode === 'simulated' ? 'bg-cyan-500 text-neutral-950 font-bold' : 'bg-neutral-800 text-neutral-400'}`}
                    >
                      Simulated Fee
                    </button>
                  </div>
                </div>

                {paymentMode === 'header' ? (
                  <div className="space-y-2">
                    <label className="text-xs text-neutral-400 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-cyan-400" />
                      X-PAYMENT / PAYMENT-SIGNATURE Header Value:
                    </label>
                    <input
                      type="text"
                      value={customXPayment}
                      onChange={(e) => setCustomXPayment(e.target.value)}
                      placeholder="e.g. x402-signature-proof-0x..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-cyan-200 focus:outline-none focus:border-cyan-500"
                    />
                    <p className="text-[11px] text-neutral-500">
                      Sending request with valid X-PAYMENT header automatically satisfies x402 v2 payment gate. Clear header to test HTTP 402 response.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-neutral-950 border border-neutral-800 rounded-lg">
                    <div>
                      <div className="text-sm font-medium">Fee Status</div>
                      <div className="text-xs text-neutral-400">0.05 USD / 50,000 micro-USDC</div>
                    </div>
                    {feePaid ? (
                      <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold bg-emerald-400/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                        <ShieldCheck className="w-4 h-4" />
                        Settled
                      </div>
                    ) : (
                      <button
                        onClick={handlePayFee}
                        className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
                      >
                        Simulate Payment
                      </button>
                    )}
                  </div>
                )}
              </section>

              <button
                onClick={handleRunEvaluation}
                disabled={loading}
                className={`w-full py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all ${
                  loading
                    ? 'bg-cyan-900/50 text-cyan-200 cursor-not-allowed'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-neutral-950 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                }`}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Consensus Swarm Analyzing...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Initiate 3-Node Swarm Assessment
                  </>
                )}
              </button>

              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <div>
                    <div className="font-semibold">{error}</div>
                    {raw402Response && (
                      <div className="mt-2 space-y-1 font-mono text-[11px] bg-neutral-950 p-2 rounded border border-rose-900/40 text-neutral-300">
                        <div><strong>x402Version:</strong> {raw402Response.x402Version}</div>
                        <div><strong>PayTo:</strong> {raw402Response.accepts?.[0]?.payTo || raw402Response.payTo}</div>
                        <div><strong>Price:</strong> {raw402Response.accepts?.[0]?.price || raw402Response.price}</div>
                        <div><strong>Network:</strong> {raw402Response.accepts?.[0]?.network || raw402Response.network}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Results Panel */}
            <div className="space-y-6">
              <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 min-h-[500px]">
                <h2 className="text-base font-semibold flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Threat Intelligence Report
                </h2>

                {!result && !loading && (
                  <div className="h-full flex flex-col items-center justify-center text-neutral-500 py-32 space-y-3">
                    <ShieldAlert className="w-12 h-12 opacity-30" />
                    <p className="text-sm">Awaiting swarm payload submission...</p>
                  </div>
                )}

                {loading && (
                  <div className="space-y-4 animate-pulse">
                    <div className="h-20 bg-neutral-800/60 rounded-xl" />
                    <div className="h-10 bg-neutral-800/60 rounded-lg" />
                    <div className="grid grid-cols-3 gap-3">
                      <div className="h-28 bg-neutral-800/60 rounded-lg" />
                      <div className="h-28 bg-neutral-800/60 rounded-lg" />
                      <div className="h-28 bg-neutral-800/60 rounded-lg" />
                    </div>
                  </div>
                )}

                {result && (
                  <div className="space-y-5">
                    {/* Score Summary Box */}
                    <div className={`p-5 rounded-xl border ${result.final_recommendation === 'GO' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
                      <div className="flex items-end justify-between mb-2">
                        <div className="text-xs font-mono uppercase tracking-wider text-neutral-400">Swarm Credit Score</div>
                        <div className={`text-4xl font-black ${result.final_recommendation === 'GO' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {result.final_creditability_score}<span className="text-lg text-neutral-500 font-normal">/1000</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-neutral-800/50 pt-2 mt-2">
                        <div className="font-bold text-base">{result.final_recommendation}</div>
                        <div className="text-xs text-neutral-300">{result.trust_level}</div>
                      </div>
                    </div>

                    {/* Detected Anomalies */}
                    {result.aggregated_flags && result.aggregated_flags.length > 0 ? (
                      <div className="space-y-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Detected Anomalies ({result.aggregated_flags.length})</h3>
                        <ul className="space-y-1.5">
                          {result.aggregated_flags.map((flag: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-300 p-2.5 rounded-lg text-xs">
                              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-400" />
                              {flag}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-3 rounded-lg text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        No threat anomalies or risk flags detected by swarm consensus.
                      </div>
                    )}

                    {/* Node Telemetry */}
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Node Telemetry (3-Node Breakdown)</h3>
                      <div className="grid grid-cols-3 gap-2.5">
                        {result.node_reports?.map((node: any, idx: number) => (
                          <div key={idx} className="bg-neutral-950 border border-neutral-800 p-3 rounded-lg">
                            <div className="text-[11px] text-neutral-400 font-mono mb-1 truncate">{node.node}</div>
                            <div className="text-lg font-black mb-0.5" style={{ color: node.score >= 800 ? '#34d399' : node.score >= 500 ? '#fbbf24' : '#f87171' }}>
                              {node.score}
                            </div>
                            <div className="text-[11px] font-medium text-neutral-300">{node.recommendation}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </main>
        )}

        {/* TAB 2: AGENTMAIL RAIL */}
        {activeTab === 'agentmail' && (
          <main className="grid md:grid-cols-2 gap-6">
            {/* Outbox / Dispatch Panel */}
            <div className="space-y-6">
              <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Send className="w-4 h-4 text-cyan-400" />
                  Dispatch AgentMail Message
                </h2>
                <form onSubmit={handleSendAgentMail} className="space-y-3">
                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">To (Recipient Agent ID)</label>
                    <input
                      type="text"
                      value={sendTo}
                      onChange={(e) => setSendTo(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-cyan-200 focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">Subject</label>
                    <input
                      type="text"
                      value={sendSubject}
                      onChange={(e) => setSendSubject(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-cyan-200 focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">Priority</label>
                    <select
                      value={sendPriority}
                      onChange={(e: any) => setSendPriority(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-cyan-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="normal">Normal</option>
                      <option value="urgent">Urgent (Threat Alert)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-neutral-400 block mb-1">Message Body</label>
                    <textarea
                      value={sendBody}
                      onChange={(e) => setSendBody(e.target.value)}
                      className="w-full h-32 bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-xs font-mono text-neutral-200 focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold py-2.5 rounded-lg text-sm transition-colors"
                  >
                    Send AgentMail Message
                  </button>
                </form>
                {mailStatusMsg && <div className="text-xs mt-2 text-neutral-300 font-mono">{mailStatusMsg}</div>}
              </section>
            </div>

            {/* Inbox Panel */}
            <div className="space-y-6">
              <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Mail className="w-4 h-4 text-cyan-400" />
                    AgentMail Inbox ({inbox.length})
                  </h2>
                  <button
                    onClick={fetchInbox}
                    disabled={mailLoading}
                    className="text-xs flex items-center gap-1 text-neutral-400 hover:text-cyan-400"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${mailLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {inbox.length === 0 ? (
                    <div className="text-xs text-neutral-500 text-center py-12">No AgentMail messages in inbox.</div>
                  ) : (
                    inbox.map((msg: any) => (
                      <div
                        key={msg.id}
                        className={`p-3.5 rounded-xl border space-y-2 ${
                          msg.priority === 'urgent'
                            ? 'bg-rose-500/10 border-rose-500/30'
                            : 'bg-neutral-950 border-neutral-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${msg.priority === 'urgent' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'bg-neutral-800 text-neutral-400'}`}>
                            {msg.priority.toUpperCase()}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-500">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-neutral-200">{msg.subject}</div>
                        <div className="text-[11px] text-neutral-400 font-mono break-all">{msg.body}</div>
                        <div className="text-[10px] text-neutral-500 flex justify-between border-t border-neutral-800/60 pt-1.5 mt-1">
                          <span>From: {msg.from}</span>
                          <span>To: {msg.to}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </main>
        )}

        {/* TAB 3: PROTOCOL & MCP SPECS */}
        {activeTab === 'protocol' && (
          <main className="space-y-6">
            <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                x402 v2 Payment Requirement Specs
              </h2>
              <div className="grid md:grid-cols-3 gap-4 font-mono text-xs">
                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                  <div className="text-neutral-500 mb-1">Network (CAIP-2)</div>
                  <div className="text-cyan-300 font-bold">eip155:8453 (Base Mainnet)</div>
                </div>
                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                  <div className="text-neutral-500 mb-1">PayTo Receiver Address</div>
                  <div className="text-emerald-400 font-bold truncate">0x8A897D546c22d726...</div>
                </div>
                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                  <div className="text-neutral-500 mb-1">Price / Asset</div>
                  <div className="text-cyan-300 font-bold">$0.05 / USDC</div>
                </div>
              </div>
            </section>

            <div className="grid md:grid-cols-2 gap-6">
              <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">OpenAPI 3.0 Spec Preview</h3>
                <pre className="bg-neutral-950 p-3.5 rounded-lg border border-neutral-800 font-mono text-[11px] text-cyan-300 max-h-96 overflow-auto">
                  {openapiSpec ? JSON.stringify(openapiSpec, null, 2) : 'Loading OpenAPI Spec...'}
                </pre>
              </section>

              <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">MCP Agent Tools Manifest</h3>
                <pre className="bg-neutral-950 p-3.5 rounded-lg border border-neutral-800 font-mono text-[11px] text-cyan-300 max-h-96 overflow-auto">
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
