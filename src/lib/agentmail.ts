export interface AgentMailMessage {
  id: string;
  thread_id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  timestamp: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: Record<string, any>;
}

export interface AgentMailThread {
  thread_id: string;
  subject: string;
  participants: string[];
  message_count: number;
  last_updated: string;
  last_message: string;
}

const inMemoryInbox: AgentMailMessage[] = [
  {
    id: "mail_init_001",
    thread_id: "thread_system_startup",
    from: "swarm_postmaster@x402-crediting-swarm.onrender.com",
    to: "all-nodes@x402-crediting-swarm.onrender.com",
    subject: "Swarm Node Initialization & x402 v2 Protocol Ready",
    body: "x402 Crediting Swarm is active across 3 nodes (Alpha, Beta, Gamma). Ready to process micropayment threat assessments and dispatch AgentMail alerts.",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    priority: "normal",
    metadata: { status: "initialized", nodes: 3 }
  }
];

export function sendAgentMail(params: {
  from?: string;
  to: string;
  subject: string;
  body: string;
  thread_id?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: Record<string, any>;
}): AgentMailMessage {
  const message: AgentMailMessage = {
    id: `mail_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    thread_id: params.thread_id || `thread_${Date.now()}`,
    from: params.from || "swarm_postmaster@x402-crediting-swarm.onrender.com",
    to: params.to,
    subject: params.subject,
    body: params.body,
    timestamp: new Date().toISOString(),
    priority: params.priority || "normal",
    metadata: params.metadata || {},
  };

  inMemoryInbox.unshift(message);
  return message;
}

export function getAgentMailInbox(limit: number = 50): AgentMailMessage[] {
  return inMemoryInbox.slice(0, limit);
}

export function getAgentMailThreads(): AgentMailThread[] {
  const threadsMap = new Map<string, AgentMailMessage[]>();
  for (const msg of inMemoryInbox) {
    if (!threadsMap.has(msg.thread_id)) {
      threadsMap.set(msg.thread_id, []);
    }
    threadsMap.get(msg.thread_id)!.push(msg);
  }

  const threads: AgentMailThread[] = [];
  for (const [threadId, msgs] of threadsMap.entries()) {
    const latest = msgs[0];
    const participants = Array.from(new Set(msgs.flatMap(m => [m.from, m.to])));
    threads.push({
      thread_id: threadId,
      subject: latest.subject,
      participants,
      message_count: msgs.length,
      last_updated: latest.timestamp,
      last_message: latest.body.substring(0, 100) + (latest.body.length > 100 ? "..." : "")
    });
  }

  return threads.sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime());
}

export function getAgentMailThread(threadId: string): AgentMailMessage[] {
  return inMemoryInbox.filter(m => m.thread_id === threadId).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}
