import { sendAgentMail, getAgentMailInbox, getAgentMailThreads, getAgentMailThread } from '@/lib/agentmail';
import { NextRequest, NextResponse } from 'next/server';

function corsJson(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "inbox";
  const threadId = searchParams.get("thread_id");

  if (action === "health") {
    return corsJson({
      status: "healthy",
      service: "MailRail AgentMail Rail",
      provider: "in-memory-ledger",
      sender: "swarm_postmaster@x402-crediting-swarm.onrender.com"
    });
  }

  if (action === "threads") {
    const threads = getAgentMailThreads();
    return corsJson({ status: "success", threads, count: threads.length });
  }

  if (threadId) {
    const messages = getAgentMailThread(threadId);
    return corsJson({ status: "success", thread_id: threadId, messages, count: messages.length });
  }

  const inbox = getAgentMailInbox();
  return corsJson({ status: "success", inbox, count: inbox.length });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, subject, body: msgBody, from, thread_id, priority, metadata } = body;

    if (!to || !subject || !msgBody) {
      return corsJson({ error: "Missing required fields: 'to', 'subject', and 'body' are required." }, 400);
    }

    const message = sendAgentMail({
      to,
      subject,
      body: msgBody,
      from,
      thread_id,
      priority,
      metadata
    });

    return corsJson({ status: "success", message });
  } catch (err: any) {
    return corsJson({ error: err.message || "Failed to process AgentMail request" }, 500);
  }
}
