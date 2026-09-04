import { NextRequest, NextResponse } from "next/server";
import { catalogEntry } from "@/lib/x402";

export async function GET(req: NextRequest) {
  const resourceUrl = new URL("/api/swarm", req.url).toString();
  return NextResponse.json({
    x402Version: 2,
    items: [catalogEntry(resourceUrl)],
  });
}
