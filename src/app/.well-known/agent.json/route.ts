import { GET as agentCardGet } from "@/app/.well-known/agent-card.json/route";

export async function GET(req: Parameters<typeof agentCardGet>[0]) {
  return agentCardGet(req);
}
